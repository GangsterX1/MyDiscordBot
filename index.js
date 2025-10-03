const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const token = process.env.DISCORD_TOKEN;

const queue = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (!message.guild) return;
    const prefix = "!"; // تقدر تغيّر البرفكس
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        const url = args[0];
        if (!url) return message.reply('اكتب رابط يوتيوب!');
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('ادخل على قناة صوتية أولاً!');
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return message.reply('لا أملك صلاحيات التحدث هنا!');
        }

        const serverQueue = queue.get(message.guild.id);
        const songInfo = await ytdl.getInfo(url);
        const song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url
        };

        if (!serverQueue) {
            const queueContruct = {
                voiceChannel,
                connection: null,
                player: createAudioPlayer(),
                songs: []
            };
            queue.set(message.guild.id, queueContruct);
            queueContruct.songs.push(song);

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator
            });
            queueContruct.connection = connection;

            playSong(message.guild, queueContruct.songs[0]);
        } else {
            serverQueue.songs.push(song);
            message.channel.send(`${song.title} تم إضافته للقائمة!`);
        }
    }

    if (command === 'skip') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('لا يوجد أغاني للتخطي!');
        serverQueue.player.stop();
    }

    if (command === 'stop') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('لا يوجد أغاني للتوقف!');
        serverQueue.songs = [];
        serverQueue.player.stop();
        serverQueue.connection.destroy();
        queue.delete(message.guild.id);
        message.channel.send('توقفت الموسيقى وتم الخروج من القناة!');
    }
});

function playSong(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    const stream = ytdl(song.url, { filter: 'audioonly' });
    const resource = createAudioResource(stream);
    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        playSong(guild, serverQueue.songs[0]);
    });

    serverQueue.player.on('error', error => console.error(error));
}
  
client.login(token);
