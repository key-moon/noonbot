import discord
from discord.ext import commands

from .main import bot, logger, SOLVED_SUFFIX
from .config import config

PERMISSION_ALLOW = discord.PermissionOverwrite(read_messages=True, manage_channels=True)
PERMISSION_DENY = discord.PermissionOverwrite(read_messages=False, manage_channels=False)

def normalize(name: str):
    return name.lower().replace("_", "-").replace(" ", "-")

# ctx -> info
def check_is_our_guild(ctx: commands.Context):
    return ctx.guild.id == config.guild_id

def check_is_bot_channel(ctx: commands.Context):
    return ctx.channel.id == config.bot_channel_id

def check_is_ctf_category(ctx: commands.Context):
    return ctx.channel.category_id not in config.special_category_ids

def get_current_ctf_name(ctx: commands.Context):
    if not check_is_ctf_category(ctx): return None
    category = ctx.channel.category
    if category is None: return None
    return category.name.removesuffix(SOLVED_SUFFIX)

def get_current_chall_name(ctx: commands.Context):
    if not check_is_ctf_category(ctx): return None
    if ctx.channel.name == config.main_channel_name: return None
    return ctx.channel.name

# info -> ctx
def get_guild():
    return bot.get_guild(config.guild_id)

def get_bot_channel():
    return get_guild().get_channel(config.bot_channel_id)

def get_ctf_category(normalized_ctf_name: str):
    for category in get_guild().categories:
        if category.name == normalized_ctf_name: return category
    return None

def get_ctf_solved_category(normalized_ctf_name: str):
    for category in get_guild().categories:
        if category.name == normalized_ctf_name + SOLVED_SUFFIX: return category
    return None

def get_ctf_categories(normalized_ctf_name: str):
    ctf_category = get_ctf_category(normalized_ctf_name)
    solved_category = get_ctf_solved_category(normalized_ctf_name)
    if ctf_category is not None and solved_category is not None:
        return ctf_category, solved_category
    return None

def get_challenge_channel(normalized_ctf_name: str, normalized_chall_name: str):
    category, solved_category = get_ctf_categories(normalized_ctf_name)
    for channel in category.text_channels + solved_category.text_channels:
        if channel.name == normalized_chall_name:
            return channel
    return None

def get_ctf_main_channel(normalized_ctf_name: str):
    return get_challenge_channel(normalized_ctf_name, config.main_channel_name)

# decorators
def bot_command(func):
    async def wrapper(ctx: commands.Context, *args):
        logger.info(f'[*] {ctx=} {args=}')
        if check_is_our_guild(ctx):
            return await func(ctx, *args)
        logger.warn(f"[!] {config.guild_id=} {ctx=}")
        await ctx.reply(f"Nope")
    return wrapper

def category_participants_only(func):
    async def wrapper(ctx: commands.Context, ctf_name: str=None, *args):
        if ctf_name is None: return
        category = get_ctf_category(normalize(ctf_name))
        if category is None: return
        if category.permissions_for(ctx.author).view_channel:
            return await func(ctx, ctf_name, *args)
        logger.warn(f"[!] {ctf_name=} {ctx=}")
        await ctx.reply(f":exclamation: You haven't enough permissions!")
    return wrapper

def bot_channel_command(func):
    @bot_command
    async def wrapper(ctx: commands.Context, *args):
        if check_is_bot_channel(ctx):
            return await func(ctx, *args)
        logger.warn(f"[!] {config.bot_channel_id=} {ctx=}")
        await ctx.reply(f":exclamation: This command can only be executed in the bot channel.")
    return wrapper

def ctf_category_command(func):
    @bot_command
    async def wrapper(ctx: commands.Context, *args):
        ctf = get_current_ctf_name(ctx)
        if ctf is not None:
            return await func(ctx, ctf, *args)
        if check_is_bot_channel(ctx):
            return await category_participants_only(func)(ctx, *args)
        logger.warn(f"[!] {ctx=}")
        await ctx.reply(f":exclamation: This command can only be executed in the bot channel or inside a CTF category.")
    return wrapper

def challenge_channel_command(func):
    @bot_command
    async def wrapper(ctx: commands.Context, *args):
        chall = get_current_chall_name(ctx)
        ctf = get_current_ctf_name(ctx)
        if chall is not None and ctf is not None:
            return await func(ctx, ctf, chall, *args)
        if ctf is not None:
            return await func(ctx, ctf, *args)
        if check_is_bot_channel(ctx):
            return await category_participants_only(func)(ctx, *args)
        logger.warn(f"[!] {ctx=}")
        await ctx.reply(f":exclamation: This command can only be executed in the bot channel or inside a challenge channel.")
    return wrapper
