from .main import bot, PIN_EMOJI
from discord import RawReactionActionEvent

@bot.event
async def on_raw_reaction_add(payload: RawReactionActionEvent):
    channel = await bot.fetch_channel(payload.channel_id) 
    message = await channel.fetch_message(payload.message_id) 

    if str(payload.emoji) != PIN_EMOJI: return
    message.remove_reaction(PIN_EMOJI, payload.user_id)
    if message.pinned:
        await message.unpin()
    else:
        await message.pin()
