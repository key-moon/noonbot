from discord.ext import commands

from .main import bot, CHECK_EMOJI
from .utils import bot_channel_command, ctf_category_command, get_ctf_categories, normalize, PERMISSION_ALLOW, PERMISSION_DENY, SOLVED_SUFFIX
from .config import config

group = bot.group("ctf")

@bot.command(name='new-ctf', group=group, usage="bot channel: !new-ctf [ctf-name]")
@bot_channel_command
async def new_ctf(ctx: commands.Context, name: str, *role_ids: int):
    expanded_role_ids = (*(config.member_role_ids if len(role_ids) == 0 else role_ids), *config.bot_role_ids)
        
    roles = [r for r in ctx.guild.roles if r.id in expanded_role_ids]
    members = sum([r.members for r in roles], [])

    overwrites = { m: PERMISSION_ALLOW for m in members }
    overwrites[ctx.guild.default_role] = PERMISSION_DENY

    main_category = await ctx.guild.create_category(normalize(name), overwrites=overwrites)
    solved_category = await ctx.guild.create_category(normalize(name) + SOLVED_SUFFIX, overwrites=overwrites)
    await ctx.guild.create_text_channel(config.main_channel_name, category=main_category)

    # なんか1,2で順番に並べるよりうまく行く気がする……らしい
    await solved_category.edit(position=1)
    await main_category.edit(position=1)
    await ctx.message.add_reaction(CHECK_EMOJI)

@bot.command(name='rename-ctf', group=group, usage="bot channel: !rename-ctf [ctf-name] [new-name]\nctf channel: !rename-ctf [new-name]")
@ctf_category_command
async def rename_ctf(ctx: commands.Context, old_name: str, new_name: str):
    categories = get_ctf_categories(normalize(old_name))
    if categories is None:
        await ctx.reply()
        return ctx.reply(f":exclamation: CTF not found.")
    category, solved_category = categories
    await category.edit(name=normalize(new_name))
    await solved_category.edit(name=normalize(new_name) + SOLVED_SUFFIX)
    await ctx.message.add_reaction(CHECK_EMOJI)
