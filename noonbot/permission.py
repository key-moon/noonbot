from discord.ext import commands

from .main import bot, CHECK_EMOJI
from .utils import bot_channel_command, ctf_category_command, get_ctf_categories, get_ctf_main_channel, normalize, PERMISSION_ALLOW, PERMISSION_DENY

@bot.command(name='leave', usage="bot channel: !leave [ctf-name]\nctf channel: !leave")
@ctf_category_command
async def leave(ctx: commands.Context, ctf_name: str):
    for category in get_ctf_categories(normalize(ctf_name)):
        await category.set_permissions(ctx.author, overwrite=PERMISSION_DENY)
    await ctx.message.add_reaction(CHECK_EMOJI)

@bot.command(name='join', usage="bot channel: !join [ctf-name]")
@bot_channel_command
async def join(ctx: commands.Context, ctf_name: str):
    channel = get_ctf_main_channel(normalize(ctf_name))
    await channel.send(content=f":scroll: audit log: {ctx.author.display_name} joined")
    for category in get_ctf_categories(normalize(ctf_name)):
        await category.set_permissions(ctx.author, overwrite=PERMISSION_ALLOW)
    await ctx.message.add_reaction(CHECK_EMOJI)
