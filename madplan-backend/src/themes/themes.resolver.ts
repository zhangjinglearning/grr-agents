import { Resolver, Query, Mutation, Args, Context } from "@nestjs/graphql";
import { UseGuards, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Theme } from "./theme.entity";
import { ThemesService } from "./themes.service";

@Resolver(() => Theme)
@UseGuards(AuthGuard("jwt"))
export class ThemesResolver {
  private readonly logger = new Logger(ThemesResolver.name);

  constructor(private readonly themesService: ThemesService) {}

  @Query(() => [Theme], { name: "themes", description: "Get all available themes" })
  async getThemes(@Context() context): Promise<Theme[]> {
    const userId = context.req.user?.id;
    this.logger.log(`User ${userId} requested all themes`);

    return this.themesService.getAllThemes();
  }

  @Query(() => Theme, { name: "theme", description: "Get a specific theme by ID" })
  async getTheme(
    @Args("themeId") themeId: string,
    @Context() context
  ): Promise<Theme> {
    const userId = context.req.user?.id;
    this.logger.log(`User ${userId} requested theme: ${themeId}`);

    return this.themesService.getThemeById(themeId);
  }
}