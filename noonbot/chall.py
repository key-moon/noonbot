from discord.ext import commands

from .main import bot, CHECK_EMOJI
from .utils import ctf_category_command, challenge_channel_command, get_ctf_solved_category, get_ctf_category, get_challenge_channel, normalize

group = bot.group("Challenge")

@bot.command(name='new-chall', group=group, usage="  bot channel: !new-chall [ctf-name] [chall-name]\n  ctf channel: !new-chall [chall-name]")
@ctf_category_command
async def new_chall(ctx: commands.Context, ctf_name: str, chall_name: str):
    category = get_ctf_category(normalize(ctf_name))
    if category is None:
        await ctx.reply(f":exclamation: Unknown ctf: {ctf_name}")
        return
    await category.create_text_channel(normalize(chall_name))
    await ctx.message.add_reaction(CHECK_EMOJI)

@bot.command(name='rename-chall', group=group, usage="  bot channel: !new-chall [ctf-name] [chall-name]\n  ctf channel: !new-chall [chall-name]")
@challenge_channel_command
async def rename_chall(ctx: commands.Context, ctf_name: str, chall_name: str, new_chall_name: str):
    channel = get_challenge_channel(normalize(ctf_name), normalize(chall_name))
    await channel.edit(name=normalize(new_chall_name))
    await ctx.message.add_reaction(CHECK_EMOJI)

@bot.command(name='solved', group=group, usage="  bot channel: !solved [ctf-name] [chall-name]\n  ctf channel: !solved [chall-name]\nchall channel: !solved")
@challenge_channel_command
async def solved(ctx: commands.Context, ctf_name: str, chall_name: str):
    channel = get_challenge_channel(normalize(ctf_name), normalize(chall_name))
    await channel.edit(category=get_ctf_solved_category(normalize(ctf_name)))
    await ctx.reply(":tada: Congratulations!")
    await ctx.message.add_reaction(CHECK_EMOJI)

@bot.command(name='unsolved', group=group, usage="  bot channel: !unsolved [ctf-name] [chall-name]\n  ctf channel: !unsolved [chall-name]\nchall channel: !unsolved")
@challenge_channel_command
async def unsolved(ctx: commands.Context, ctf_name: str, chall_name: str):
    channel = get_challenge_channel(normalize(ctf_name), normalize(chall_name))
    await channel.edit(category=get_ctf_category(normalize(ctf_name)))
    await ctx.message.add_reaction(CHECK_EMOJI)
