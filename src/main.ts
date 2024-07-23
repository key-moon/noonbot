import {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import fetch from "node-fetch";
import crypto from "crypto";

class InteractionError extends Error {}

const client = new Client({
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.Guilds,
  ],
});

const token = process.env.DISCORD_APPLICATION_TOKEN;
const clientId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token || !clientId || !guildId) {
  console.error("environment variable is not set!");
  process.exit(1);
}

client.once("ready", () => {
  console.log("Bot is ready!");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  try {
    if (!interaction.inCachedGuild())
      throw new InteractionError(
        "Unexpected error(non-cached guild). Please report to admin."
      );
    const { commandName, options, guild, member } = interaction;
    if (!guild)
      throw new InteractionError("This command can only be used in a server");
    if (!member)
      throw new InteractionError(
        "Unexpected error(nullish member). Please report to admin."
      );

    const getCtfCategories = (ctfName: string) => {
      const unsolvedCategory = guild.channels.cache.find(
        (c) => c.name === ctfName && c.type === ChannelType.GuildCategory
      );
      if (!unsolvedCategory)
        throw new InteractionError(
          `unsolved category for ${ctfName} not found`
        );
      const solvedCategory = guild.channels.cache.find(
        (c) =>
          c.name === `${ctfName}-solved` && c.type === ChannelType.GuildCategory
      );
      if (!solvedCategory)
        throw new InteractionError(`solved category for ${ctfName} not found`);
      return { solvedCategory, unsolvedCategory };
    };

    const getCtfChannels = (ctfName: string) => {
      const { unsolvedCategory, solvedCategory } = getCtfCategories(ctfName);
      return guild.channels.cache.filter(
        (c) =>
          c.parentId === unsolvedCategory.id || c.parentId === solvedCategory.id
      );
    };

    const getGeneralChannel = (ctfName: string) => {
      const { unsolvedCategory } = getCtfCategories(ctfName);
      const res = guild.channels.cache.find(
        (c) =>
          c.type == ChannelType.GuildText &&
          c.name === "general" &&
          c.parentId === unsolvedCategory.id
      ) as TextChannel | undefined;
      if (!res)
        throw new InteractionError(`general channel for ${ctfName} not found`);
      return res;
    };

    const getCtfRoleAndName = () => {
      const ctfRole = options.get("ctf-role", true).role!;
      if (!ctfRole.name.startsWith("ctf-")) {
        throw new InteractionError(
          "Invalid role name. Role name should start with `ctf-`"
        );
      }
      const ctfName = ctfRole.name.substring(4);
      return { ctfRole, ctfName };
    };

    if (commandName === "create-ctf") {
      const ctfName = options.get("ctf-name", true).value!.toString();

      // Create the role
      const role = await guild.roles.create({
        name: `ctf-${ctfName}`,
        position: guild.roles.highest.position,
      });

      // Add the role to all members
      (await guild.members.fetch()).forEach((member) => {
        member.roles.add(role);
      });

      // Create categories and channels
      const category = await guild.channels.create({
        name: ctfName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ["ViewChannel"],
          },
          {
            id: role.id,
            allow: ["ViewChannel"],
          },
        ],
      });
      await guild.channels.create({
        name: `${ctfName}-solved`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ["ViewChannel"],
          },
          {
            id: role.id,
            allow: ["ViewChannel"],
          },
        ],
      });
      await guild.channels.create({
        name: "general",
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          { id: guild.id, deny: ["ViewChannel"] },
          { id: role.id, allow: ["ViewChannel"] },
        ],
      });

      await interaction.reply({
        content: `CTF ${ctfName} created with role and channels.`,
        ephemeral: true,
      });
    } else if (commandName === "delete") {
      const { ctfName, ctfRole } = getCtfRoleAndName();
      const ctfRoleMd5 = options.get("ctf-role-md5", true).value!.toString();
      if (
        crypto.createHash("md5").update(ctfRole.name).digest("hex") !==
        ctfRoleMd5
      ) {
        throw new InteractionError("you fool!");
      }

      await Promise.all(
        getCtfChannels(ctfName).map((channel) => channel.delete())
      );
      const { solvedCategory, unsolvedCategory } = getCtfCategories(ctfName);
      await solvedCategory.delete();
      await unsolvedCategory.delete();
      await ctfRole.delete();
      await interaction.reply({ content: "done!", ephemeral: true });
    } else if (commandName === "over") {
      const { ctfName, ctfRole } = getCtfRoleAndName();
      const generalChannel = getGeneralChannel(ctfName);

      guild.channels.cache
        .filter((c) => c.permissionsFor(ctfRole))
        .forEach((channel) => {
          const permission = channel.permissionsFor(guild.id);
          if (!permission) {
            console.error(`! ${channel.name}`);
            return;
          }
          channel.edit({
            permissionOverwrites: [{ id: guild.id, allow: ["ViewChannel"] }],
          });
        });

      await generalChannel.send(`:scroll: audit log: CTF is now public!`);
      await interaction.reply({
        content: `OK! ${ctfName}.`,
        ephemeral: true,
      });
    } else if (commandName === "leave") {
      const { ctfName, ctfRole } = getCtfRoleAndName();

      await interaction.member.roles.remove(ctfRole);
      await interaction.reply({
        content: `You have left the CTF ${ctfName}.`,
        ephemeral: true,
      });
    } else if (commandName === "join") {
      const { ctfName, ctfRole } = getCtfRoleAndName();
      const generalChannel = getGeneralChannel(ctfName);

      await interaction.member.roles.add(ctfRole);
      await generalChannel.send(
        `:scroll: audit log: ${member.displayName} joined!`
      );
      await interaction.reply({
        content: `You have joined the CTF ${ctfName}.`,
        ephemeral: true,
      });
    } else if (commandName === "player") {
      const playerRole = await guild.roles.cache.find(
        (role) => role.name === "player"
      );
      if (!playerRole) throw new InteractionError("player role not found");

      await interaction.member.roles.add(playerRole);

      await interaction.reply({
        content: `You have been set as a player.`,
        ephemeral: true,
      });
    } else if (commandName === "non-player") {
      const nonPlayerRole = await guild.roles.cache.find(
        (role) => role.name === "non-player"
      );
      if (!nonPlayerRole)
        throw new InteractionError("non-player role not found");

      await interaction.member.roles.add(nonPlayerRole);

      await interaction.reply({
        content: `You have been set as a non-player.`,
        ephemeral: true,
      });
    } else if (commandName === "upcomings") {
      const startsIn = (options.get("starts-in")?.value ?? 10) as number;

      const limit = 100;
      const startTimestamp = Math.floor(Date.now() / 1000);
      const finishTimestamp = startTimestamp + startsIn * 24 * 60 * 60;

      const url = `https://ctftime.org/api/v1/events/?limit=${limit}&start=${startTimestamp}&finish=${finishTimestamp}`;

      const response = await fetch(url);
      const events = (await response.json()) as any;

      let message = "Upcoming CTFs:\n";
      events.forEach((event: any) => {
        message += `[${event.title}](${event.url})([ctftime](${
          event.ctftime_url
        })) from <t:${Math.floor(
          new Date(event.start).getTime() / 1000
        )}:F> to <t:${Math.floor(
          new Date(event.finish).getTime() / 1000
        )}:F> by ${event.organizers[0].name}\n`;
      });
      message += "```\n" + message + "\n```";

      await interaction.reply({ content: message, ephemeral: true });
    }
  } catch (e) {
    if (e instanceof InteractionError) {
      await interaction.reply({ content: e.message, ephemeral: true });
    } else {
      console.error(e);
      await interaction.reply({
        content: `unhandled error: ${e}`,
        ephemeral: true,
      });
    }
  }
});

const commands = [
  new SlashCommandBuilder()
    .setName("create-ctf")
    .setDescription("Create a new CTF")
    .addStringOption((option) =>
      option
        .setName("ctf-name")
        .setDescription("Name of the CTF")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog),
  new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Delete the CTF")
    .addRoleOption((option) =>
      option
        .setName("ctf-role")
        .setDescription("Role of the CTF (@ctf-[name])")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("ctf-role-md5")
        .setDescription(
          "foolproof option. `printf [role-name(without @)] | md5sum`"
        )
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog),
  new SlashCommandBuilder()
    .setName("over")
    .setDescription("Make the CTF public")
    .addRoleOption((option) =>
      option
        .setName("ctf-role")
        .setDescription("Role of the CTF (@ctf-[name])")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog),
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join the CTF")
    .addRoleOption((option) =>
      option
        .setName("ctf-role")
        .setDescription("Role of the CTF (@ctf-[name])")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Leave the CTF")
    .addRoleOption((option) =>
      option
        .setName("ctf-role")
        .setDescription("Role of the CTF (@ctf-[name])")
        .setRequired(true)
    ),
  new SlashCommandBuilder().setName("player").setDescription("Set as player"),
  new SlashCommandBuilder()
    .setName("non-player")
    .setDescription("Set as non-player"),
  new SlashCommandBuilder()
    .setName("upcomings")
    .setDescription("List upcoming CTFs")
    .addNumberOption((option) =>
      option
        .setName("starts-in")
        .setDescription("Starts in N days (default: 10)")
        .setRequired(false)
    ),
];

const rest = new REST({ version: "9" }).setToken(token);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();

client.login(token);
