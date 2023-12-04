import { WebcastPushConnection } from "tiktok-live-connector";
import http from 'http'; // Import http
import pkg from 'faye-websocket';
const FayeClient = pkg.Client;
import fs from 'fs';
const tiktokUsername = '@hezkyxyz'; // replace with your TikTok username
const key = 'change_me'; // replace with your key
let ws = null; // Define ws here
import util from 'util';
const connection = new WebcastPushConnection(tiktokUsername);
const playername = 'melser';
let wson = false;

function connectWebSocket() {
    const options = {
        host: 'localhost',
        port: 4567,
        path: '/v1/ws/console',
        headers: {
            'Cookie': `x-servertap-key=${key}`
        }
    };

    ws = new FayeClient(`ws://${options.host}:${options.port}${options.path}`, null, { headers: options.headers });

    ws.on('open', function open() {
        console.log('connected to websocket');
        wson = true;
        sendCommand(`/say Connected to roomId by ${tiktokUsername}`);
    });

    ws.on('error', function error(err) {
        console.log('Failed to connect to WebSocket', err);
    });
}

connection.connect().then(() => {
    console.info(`Connected to roomId by ${tiktokUsername}`);
    connectWebSocket();
}).catch(err => {
    console.error('Failed to connect to TikTok', err);
});
connection.on('chat', data => {
    console.log(`${data.uniqueId} : ${data.comment}`);

    // Add the message to the queue
    handleEvent('chat', data);
});

connection.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) {
        // Streak in progress => show only temporarily
        console.log(`${data.uniqueId} is sending gift ${data.giftName} x${data.repeatCount}`);
    } else {
        // Streak ended or non-streakable gift => process the gift with final repeat_count
        console.log(`${data.uniqueId} has sent gift ${data.giftName} x${data.repeatCount}`);
    }

    handleEvent(`${data.uniqueId}:${data.giftName}x${data.repeatCount} `);
    handleEvent('gift', data);
});

connection.on('envelope', data => {
    handleEvent('envelope', data);
});

connection.on('subscribe', data => {
    handleEvent('subscribe', data);
});

connection.on('follow', data => {
    console.log(`${data.uniqueId} te sigue!`);
    handleEvent('follow', data);
});
connection.on('share', (data) => {
    console.log(`${data.uniqueId} compartio!`);
    handleEvent('share', data);
})
connection.on('member', data => {
    console.log(`welcome ${data.uniqueId}!`);
    handleEvent('welcome', data);
});
const keywordTogive = {
    'arena': 'minecraft:sand',
    'azúcar': 'minecraft:sugar',
};
const keywordTomob = {
    'enderman': 'minecraft:enderman',
    'pig': 'minecraft:pig',
};


function handleEvent(eventType, data) {
    const commandList = JSON.parse(fs.readFileSync('commandList.json', 'utf8'));
    let commands = [];

    if (commandList[eventType]) {
        let eventCommands = commandList[eventType];
        if (!Array.isArray(eventCommands)) {
            console.error(`eventCommands for ${eventType} is not an array`);
            return;
        }
        eventCommands.forEach(command => {
            let replacedCommand = command.replace('{uniqueId}', data.uniqueId || '')
                .replace('{comment}', data.comment || '')
                .replace('{message}', data.comment || '')
                .replace('{giftName}', data.giftName || '')
                .replace('{repeatCount}', data.repeatCount || '')
                .replace('{playername}', commandList.playername || '');

            // Si el comando es para dar un artículo y el comentario contiene una palabra clave válida, reemplaza {item} con el artículo correspondiente
            if (command.includes('give {playername} {item}') && keywordTogive[data.comment]) {
                replacedCommand = replacedCommand.replace('{item}', keywordTogive[data.comment]);
            }

            // Si el comando es para invocar un mob y el comentario contiene una palabra clave válida, reemplaza {mob} con el mob correspondiente
            if (command.includes('summon {mob}') && keywordTomob[data.comment]) {
                replacedCommand = replacedCommand.replace('{mob}', keywordTomob[data.comment]);
            }

            commands.push(replacedCommand);
        });
        for (const command of commands) {
            sendCommand(command);
        }

        commandList[`last${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`] = data.uniqueId;
        fs.writeFileSync('commandList.json', JSON.stringify(commandList, null, 2));

        // Display the last values in the action bar
        let delay = 0;
        for (const [key, value] of Object.entries(commandList.scoreboard)) {
            let objectiveName = key;
            let playerName = value;

            // Display the objective in the action bar with a delay
            setTimeout(() => {
                sendCommand(`/title @a actionbar {"text":"${objectiveName}: ${playerName}"}`);
            }, delay);

            // Increase the delay by 2 seconds for the next message
            delay += 2000;
        }
    }
}

async function sendCommand(command) {
    if (command === null) {
        return;
    }
    if (wson) { // Verifica si wson es true
    } else {
        console.log('no conectado');
        connectWebSocket();
        return;
    }
    try {
        ws.send(command);
    } catch (error) {
        console.error('Error command:', error);
    }
}