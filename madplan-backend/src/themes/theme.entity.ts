import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";
import { IsString, IsNotEmpty, IsEnum, IsNumber, IsBoolean, ValidateNested, IsArray, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export type ThemeDocument = Theme & Document;

// Enum definitions for GraphQL and validation
export enum CardStyle {
  ROUNDED = "rounded",
  SQUARED = "squared", 
  TEXTURED = "textured",
}

export enum AnimationIntensity {
  SUBTLE = "subtle",
  NORMAL = "normal",
  PLAYFUL = "playful",
}

export enum TypographyScale {
  COMPACT = "compact",
  COMFORTABLE = "comfortable", 
  SPACIOUS = "spacious",
}

// Register enums for GraphQL
registerEnumType(CardStyle, {
  name: "CardStyle",
  description: "Visual style options for cards",
});

registerEnumType(AnimationIntensity, {
  name: "AnimationIntensity", 
  description: "Animation intensity levels",
});

registerEnumType(TypographyScale, {
  name: "TypographyScale",
  description: "Typography scaling options",
});

@Schema()
@ObjectType()
export class ColorPalette {
  @Prop({ type: [String], required: true })
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  primary: string[];

  @Prop({ type: [String], required: true })
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  secondary: string[];

  @Prop({ type: [String], required: true })
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  accent: string[];

  @Prop({ type: [String], required: true })
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  neutral: string[];
}

@Schema()
@ObjectType()
export class ThemeBackgrounds {
  @Prop({ required: true })
  @Field()
  @IsString()
  @IsNotEmpty()
  main: string;

  @Prop({ required: true })
  @Field()
  @IsString()
  @IsNotEmpty()
  card: string;

  @Prop({ required: true })
  @Field()
  @IsString()
  @IsNotEmpty()
  list: string;
}

@Schema()
@ObjectType()
export class ThemeTypography {
  @Prop({ 
    type: String,
    enum: TypographyScale,
    default: TypographyScale.COMFORTABLE
  })
  @Field(() => TypographyScale)
  @IsEnum(TypographyScale)
  scale: TypographyScale;

  @Prop({ required: true })
  @Field()
  @IsString()
  @IsNotEmpty()
  weight: string;
}

@Schema()
@ObjectType()
export class ThemeAnimations {
  @Prop({ 
    type: String,
    enum: AnimationIntensity,
    default: AnimationIntensity.NORMAL
  })
  @Field(() => AnimationIntensity)
  @IsEnum(AnimationIntensity)
  intensity: AnimationIntensity;

  @Prop({ required: true })
  @Field()
  @IsString()
  @IsNotEmpty()
  duration: string;
}

@Schema()
@ObjectType()
export class ThemeAccessibility {
  @Prop({ required: true })
  @Field()
  @IsNumber()
  contrastRatio: number;

  @Prop({ required: true })
  @Field()
  @IsBoolean()
  colorBlindnessSupport: boolean;

  @Prop({ required: true })
  @Field()
  @IsBoolean()
  reducedMotion: boolean;
}

@Schema()
@ObjectType()
export class ThemeCustomizations {
  @Prop({ required: false })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  backgroundVariant?: string;

  @Prop({ 
    type: String,
    enum: CardStyle,
    required: false
  })
  @Field(() => CardStyle, { nullable: true })
  @IsOptional()
  @IsEnum(CardStyle)
  cardStyle?: CardStyle;

  @Prop({ 
    type: String,
    enum: AnimationIntensity,
    required: false
  })
  @Field(() => AnimationIntensity, { nullable: true })
  @IsOptional()
  @IsEnum(AnimationIntensity)
  animationIntensity?: AnimationIntensity;

  @Prop({ 
    type: String,
    enum: TypographyScale,
    required: false
  })
  @Field(() => TypographyScale, { nullable: true })
  @IsOptional()
  @IsEnum(TypographyScale)
  typographyScale?: TypographyScale;
}

@Schema()
@ObjectType()
export class BoardTheme {
  @Prop({ required: true })
  @Field()
  @IsString()
  @IsNotEmpty()
  themeId: string;

  @Prop({ 
    type: ThemeCustomizations,
    required: false
  })
  @Field(() => ThemeCustomizations, { nullable: true })
  @ValidateNested()
  @Type(() => ThemeCustomizations)
  @IsOptional()
  customizations?: ThemeCustomizations;
}

@Schema({
  timestamps: true,
  collection: "themes",
})
@ObjectType()
export class Theme {
  @Field(() => ID)
  id: string;

  @Prop({ 
    required: true,
    unique: true,
    trim: true,
  })
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Prop({ required: true })
  @Field()
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @Prop({ required: true })
  @Field()
  @IsString()
  @IsNotEmpty()
  description: string;

  @Prop({ required: true })
  @Field()
  @IsString()
  @IsNotEmpty()
  inspiration: string;

  @Prop({ 
    type: ColorPalette,
    required: true
  })
  @Field(() => ColorPalette)
  @ValidateNested()
  @Type(() => ColorPalette)
  colorPalette: ColorPalette;

  @Prop({ 
    type: ThemeBackgrounds,
    required: true
  })
  @Field(() => ThemeBackgrounds)
  @ValidateNested()
  @Type(() => ThemeBackgrounds)
  backgrounds: ThemeBackgrounds;

  @Prop({ 
    type: ThemeTypography,
    required: true
  })
  @Field(() => ThemeTypography)
  @ValidateNested()
  @Type(() => ThemeTypography)
  typography: ThemeTypography;

  @Prop({ 
    type: ThemeAnimations,
    required: true
  })
  @Field(() => ThemeAnimations)
  @ValidateNested()
  @Type(() => ThemeAnimations)
  animations: ThemeAnimations;

  @Prop({ 
    type: ThemeAccessibility,
    required: true
  })
  @Field(() => ThemeAccessibility)
  @ValidateNested()
  @Type(() => ThemeAccessibility)
  accessibility: ThemeAccessibility;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}

export const ThemeSchema = SchemaFactory.createForClass(Theme);
export const ColorPaletteSchema = SchemaFactory.createForClass(ColorPalette);
export const ThemeBackgroundsSchema = SchemaFactory.createForClass(ThemeBackgrounds);
export const ThemeTypographySchema = SchemaFactory.createForClass(ThemeTypography);
export const ThemeAnimationsSchema = SchemaFactory.createForClass(ThemeAnimations);
export const ThemeAccessibilitySchema = SchemaFactory.createForClass(ThemeAccessibility);
export const ThemeCustomizationsSchema = SchemaFactory.createForClass(ThemeCustomizations);
export const BoardThemeSchema = SchemaFactory.createForClass(BoardTheme);

// Create index on name for optimized query performance
ThemeSchema.index({ name: 1 }, { unique: true });

// Transform the toJSON output to include id and exclude MongoDB internals
ThemeSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Transform the toObject output similarly
ThemeSchema.set("toObject", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});