const https = require('https');

exports.handler = async (event) => {
    console.log('Alert processor triggered:', JSON.stringify(event, null, 2));
    
    try {
        // Process CloudWatch alarms
        if (event.Records) {
            for (const record of event.Records) {
                if (record.EventSource === 'aws:sns') {
                    await processCloudWatchAlarm(JSON.parse(record.Sns.Message));
                }
            }
        }
        
        // Process scheduled monitoring checks
        if (event.source === 'aws.events') {
            await performHealthChecks();
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Alert processing completed successfully' })
        };
    } catch (error) {
        console.error('Error processing alerts:', error);
        
        // Send error notification
        await sendSlackNotification({
            type: 'error',
            title: 'Alert Processor Error',
            message: error.message,
            severity: 'high',
            timestamp: new Date().toISOString()
        });
        
        throw error;
    }
};

async function processCloudWatchAlarm(message) {
    console.log('Processing CloudWatch alarm:', JSON.stringify(message, null, 2));
    
    const {
        AlarmName,
        NewStateValue,
        NewStateReason,
        StateChangeTime,
        Region,
        AlarmDescription,
        MetricName,
        Namespace,
        Statistic,
        Threshold
    } = message;
    
    // Determine alert severity based on alarm name and state
    const severity = getSeverity(AlarmName, NewStateValue);
    const color = getColorForSeverity(severity);
    const emoji = getEmojiForSeverity(severity);
    
    // Create structured alert message
    const alertData = {
        type: 'cloudwatch_alarm',
        title: `${emoji} ${AlarmName}`,
        message: NewStateReason,
        severity: severity,
        state: NewStateValue,
        timestamp: StateChangeTime,
        region: Region,
        metric: {
            name: MetricName,
            namespace: Namespace,
            statistic: Statistic,
            threshold: Threshold
        },
        color: color,
        description: AlarmDescription
    };
    
    // Send notification based on severity
    if (severity === 'critical') {
        await Promise.all([
            sendSlackNotification(alertData),
            sendDatadogEvent(alertData),
            sendCustomNotification(alertData)
        ]);
    } else {
        await sendSlackNotification(alertData);
    }
    
    // Log structured event for analysis
    console.log('Processed alert:', JSON.stringify(alertData, null, 2));
}

async function performHealthChecks() {
    console.log('Performing scheduled health checks');
    
    const healthChecks = [
        checkApplicationHealth(),
        checkDatabaseHealth(),
        checkExternalServices()
    ];
    
    try {
        const results = await Promise.allSettled(healthChecks);
        
        let failedChecks = 0;
        const checkResults = [];
        
        results.forEach((result, index) => {
            const checkName = ['Application', 'Database', 'External Services'][index];
            
            if (result.status === 'rejected') {
                failedChecks++;
                checkResults.push({
                    name: checkName,
                    status: 'failed',
                    error: result.reason.message,
                    timestamp: new Date().toISOString()
                });
            } else {
                checkResults.push({
                    name: checkName,
                    status: 'passed',
                    data: result.value,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Send custom CloudWatch metrics
        await sendCustomMetrics({
            'HealthChecks.FailedCount': failedChecks,
            'HealthChecks.TotalCount': healthChecks.length,
            'HealthChecks.SuccessRate': ((healthChecks.length - failedChecks) / healthChecks.length) * 100
        });
        
        // Alert if multiple health checks fail
        if (failedChecks > 1) {
            await sendSlackNotification({
                type: 'health_check',
                title: '🚨 Multiple Health Checks Failed',
                message: `${failedChecks} out of ${healthChecks.length} health checks failed`,
                severity: 'critical',
                timestamp: new Date().toISOString(),
                details: checkResults,
                color: '#ff0000'
            });
        }
        
    } catch (error) {
        console.error('Health check error:', error);
        throw error;
    }
}

async function checkApplicationHealth() {
    const healthEndpoint = process.env.APPLICATION_ENDPOINT || 'https://madplan.com/api/health';
    
    return new Promise((resolve, reject) => {
        const req = https.get(healthEndpoint, { timeout: 10000 }, (res) => {
            let data = '';
            
            res.on('data', chunk => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const healthData = JSON.parse(data);
                        resolve({
                            status: 'healthy',
                            responseTime: Date.now() - req.startTime,
                            data: healthData
                        });
                    } catch (e) {
                        resolve({
                            status: 'healthy',
                            responseTime: Date.now() - req.startTime,
                            data: { raw: data }
                        });
                    }
                } else {
                    reject(new Error(`Health check failed with status ${res.statusCode}`));
                }
            });
        });
        
        req.startTime = Date.now();
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Health check timeout'));
        });
        
        req.on('error', (error) => {
            reject(new Error(`Health check error: ${error.message}`));
        });
    });
}

async function checkDatabaseHealth() {
    // Simulated database health check
    // In a real implementation, this would check database connectivity
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                status: 'healthy',
                connections: Math.floor(Math.random() * 50) + 10,
                responseTime: Math.floor(Math.random() * 100) + 20
            });
        }, Math.random() * 1000);
    });
}

async function checkExternalServices() {
    // Check external dependencies like MongoDB Atlas, third-party APIs
    const services = ['MongoDB Atlas', 'Auth0', 'Stripe'];
    const results = {};
    
    for (const service of services) {
        // Simulated external service check
        results[service] = {
            status: Math.random() > 0.1 ? 'healthy' : 'unhealthy',
            responseTime: Math.floor(Math.random() * 200) + 50
        };
    }
    
    return results;
}

async function sendSlackNotification(alertData) {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || '${slack_webhook_url}';
    
    if (!slackWebhookUrl) {
        console.log('Slack webhook URL not configured, skipping Slack notification');
        return;
    }
    
    const slackMessage = {
        username: 'MadPlan Monitor',
        icon_emoji: ':warning:',
        attachments: [{
            color: alertData.color || (alertData.severity === 'critical' ? 'danger' : 'warning'),
            title: alertData.title,
            text: alertData.message,
            fields: [
                {
                    title: 'Severity',
                    value: alertData.severity,
                    short: true
                },
                {
                    title: 'Timestamp',
                    value: alertData.timestamp,
                    short: true
                }
            ],
            footer: 'MadPlan Monitoring',
            ts: Math.floor(Date.now() / 1000)
        }]
    };
    
    // Add additional fields based on alert type
    if (alertData.metric) {
        slackMessage.attachments[0].fields.push(
            {
                title: 'Metric',
                value: `${alertData.metric.namespace}/${alertData.metric.name}`,
                short: true
            },
            {
                title: 'Threshold',
                value: alertData.metric.threshold,
                short: true
            }
        );
    }
    
    if (alertData.details) {
        slackMessage.attachments[0].fields.push({
            title: 'Details',
            value: JSON.stringify(alertData.details, null, 2),
            short: false
        });
    }
    
    return makeHttpsRequest(slackWebhookUrl, 'POST', JSON.stringify(slackMessage));
}

async function sendDatadogEvent(alertData) {
    const datadogApiKey = process.env.DATADOG_API_KEY || '${datadog_api_key}';
    
    if (!datadogApiKey) {
        console.log('Datadog API key not configured, skipping Datadog event');
        return;
    }
    
    const datadogEvent = {
        title: alertData.title,
        text: alertData.message,
        priority: alertData.severity === 'critical' ? 'high' : 'normal',
        tags: [
            'source:cloudwatch',
            `environment:${process.env.ENVIRONMENT || 'production'}`,
            `severity:${alertData.severity}`,
            'service:madplan-backend'
        ],
        alert_type: alertData.severity === 'critical' ? 'error' : 'warning',
        date_happened: Math.floor(Date.parse(alertData.timestamp) / 1000)
    };
    
    const options = {
        hostname: 'api.datadoghq.com',
        port: 443,
        path: `/api/v1/events?api_key=${datadogApiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    return makeHttpsRequest('https://api.datadoghq.com/api/v1/events', 'POST', JSON.stringify(datadogEvent), {
        'Content-Type': 'application/json',
        'DD-API-KEY': datadogApiKey
    });
}

async function sendCustomNotification(alertData) {
    // Custom notification logic for critical alerts
    // Could integrate with PagerDuty, custom webhooks, etc.
    console.log('Sending custom notification for critical alert:', alertData.title);
    
    // Example: Send to custom webhook
    const customWebhook = process.env.CUSTOM_WEBHOOK_URL;
    if (customWebhook) {
        const payload = {
            event_type: 'critical_alert',
            service: 'madplan-backend',
            alert: alertData,
            environment: process.env.ENVIRONMENT || 'production'
        };
        
        await makeHttpsRequest(customWebhook, 'POST', JSON.stringify(payload));
    }
}

async function sendCustomMetrics(metrics) {
    const AWS = require('aws-sdk');
    const cloudwatch = new AWS.CloudWatch();
    
    const metricData = Object.entries(metrics).map(([name, value]) => ({
        MetricName: name,
        Value: value,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: [
            {
                Name: 'Service',
                Value: 'madplan-backend'
            },
            {
                Name: 'Environment',
                Value: process.env.ENVIRONMENT || 'production'
            }
        ]
    }));
    
    const params = {
        Namespace: 'MadPlan/Monitoring',
        MetricData: metricData
    };
    
    try {
        await cloudwatch.putMetricData(params).promise();
        console.log('Custom metrics sent successfully');
    } catch (error) {
        console.error('Error sending custom metrics:', error);
    }
}

function getSeverity(alarmName, state) {
    if (state !== 'ALARM') return 'info';
    
    const criticalAlarms = ['application-down', 'database-connection', 'high-error-rate'];
    const warningAlarms = ['high-response-time', 'high-cpu', 'high-memory'];
    
    const alarmType = alarmName.toLowerCase();
    
    if (criticalAlarms.some(alarm => alarmType.includes(alarm))) {
        return 'critical';
    } else if (warningAlarms.some(alarm => alarmType.includes(alarm))) {
        return 'warning';
    }
    
    return 'info';
}

function getColorForSeverity(severity) {
    switch (severity) {
        case 'critical': return '#ff0000';
        case 'warning': return '#ffa500';
        case 'info': return '#0099cc';
        default: return '#808080';
    }
}

function getEmojiForSeverity(severity) {
    switch (severity) {
        case 'critical': return '🚨';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '📊';
    }
}

function makeHttpsRequest(url, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }
        
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(responseData);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (data) {
            req.write(data);
        }
        
        req.end();
    });
}