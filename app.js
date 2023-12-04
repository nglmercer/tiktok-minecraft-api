const key = 'change_me';
const WebSocket = require('ws');
const { WebcastPushConnection } = require('tiktok-live-connector');
let ws = null;
let reconnectInterval;
const fs = require('fs');
const tunnel = require('tunnel');
let state;
let activeConnections = 0;
const maxConnections = 100; // Set your limit
let tiktokLiveConnection = null;

let ipRequestCounts = {};

setInterval(() => {
    ipRequestCounts = {};
}, 60 * 1000)

const proxies = [{
        host: '192.168.0.101',
        port: '8080',
    },
    {
        host: '172.16.254.1',
        port: '8000',
    },
    {
        host: '10.0.0.1',
        port: '8081',
    },
    {
        host: '192.168.1.254',
        port: '8001',
    },
    // Agrega más proxies según sea necesario
];

let activeProxyIndex = 0;

function getNextProxy() {
    const proxy = proxies[activeProxyIndex];
    activeProxyIndex = (activeProxyIndex + 1) % proxies.length; // Avanza al siguiente proxy circularmente
    return proxy;
}

function connectWithProxy() {
    const proxy = getNextProxy();
    const proxyOptions = {
        host: proxy.host,
        port: proxy.port,
        headers: {
            // Aquí puedes agregar encabezados adicionales para el proxy si es necesario
        },
    };

    tiktokLiveConnection = new WebcastPushConnection('@jailexuwu', {
        processInitialData: false,
        enableExtendedGiftInfo: true,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 200,
        clientParams: {
            "app_language": "en-US",
            "device_platform": "web"
        },
        requestHeaders: {
            "headerName": "headerValue"
        },
        websocketHeaders: {
            "headerName": "headerValue"
        },
        requestOptions: {
            timeout: 1000
        },
        websocketOptions: {
            timeout: 1000
        },
        // ...
        requestOptions: {
            tunnel: tunnel.httpsOverHttp(proxyOptions), // Utiliza el proxy para la conexión
            timeout: 1000,
        },
        websocketOptions: {
            tunnel: tunnel.httpsOverHttp(proxyOptions), // Utiliza el proxy para la conexión WebSocket
            timeout: 1000,
        },
    });

    tiktokLiveConnection.connect()
        .then(s => {
            if (activeConnections >= maxConnections) {
                throw new Error('Connection limit reached');
            }

            activeConnections++;
            state = s;
            console.info(`Connected to room ${state.roomId}`);
        })
        .catch(err => {
            console.error('Failed to connect', err);
            connectWithProxy(); // Intenta conectar con el siguiente proxy en caso de error
        });

    tiktokLiveConnection.on('disconnect', () => {
        activeConnections--;
        console.log('Disconnected');
        connectWithProxy(); // Intenta conectar con el siguiente proxy en caso de desconexión
    });

    tiktokLiveConnection.on('streamEnd', (actionId) => {
        console.log('Stream end');
        if (actionId === 3) {
            console.log('Stream ended by user');
        }
        if (actionId === 4) {
            console.log('Stream ended by platform moderator (ban)');
        }
    });
}

connectWithProxy();
tiktokLiveConnection.on('chat', data => {
    console.log(`${data.uniqueId} : ${data.comment}`);
    const message = data.comment;

    // Add the message to the queue
    handleEvent(`${data.uniqueId}:${message} `);
    handleEvent('chat', data);
});

tiktokLiveConnection.on('gift', data => {
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

tiktokLiveConnection.on('envelope', data => {
    handleEvent('envelope', data);
});

tiktokLiveConnection.on('subscribe', data => {
    handleEvent('subscribe', data);
});

tiktokLiveConnection.on('follow', data => {
    console.log(`${data.uniqueId} te sigue!`);
    handleEvent('follow', data);
});
tiktokLiveConnection.on('share', (data) => {
    console.log(`${data.uniqueId} compartio!`);
    handleEvent('share', data);
})
tiktokLiveConnection.on('member', data => {
    console.log(`welcome ${data.uniqueId}!`);
})
const commandList = JSON.parse(fs.readFileSync('commandList.json'));
const commandGiftList = JSON.parse(fs.readFileSync('commandGiftList.json'));

function connectWebSocket(message) {
    if (ws !== null && ws.readyState !== WebSocket.CLOSED) {
        console.log('WebSocket is already connected or connecting.');
        return;
    }

    ws = new WebSocket('ws://localhost:4567/v1/ws/console', {
        headers: {
            'Cookie': `x-servertap-key=${key}`
        }
    });

    ws.on('open', function open() {
        console.log('WebSocket connection opened. Sending default command to server.');
        if (state) {
            sendCommand(`/say Server connected to TikTok with room id ${state.roomId}`);
        } else {
            sendCommand(`/say Failed to connect to TikTok`);
        }
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    });

    ws.on('error', function error(err) {
        console.error('WebSocket Error: ', err);
    });

    ws.on('close', function close() {
        console.log('WebSocket closed. Reconnecting...');
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                connectWebSocket(message);
            }, 1000); // try to reconnect every second
        }
    });
}

const playername = 'melser';
// Definir la variable para el comando de sonido
const keywordToItemMap = {
    'arena': 'minecraft:sand',
    'azúcar': 'minecraft:sugar',
    'azada': 'minecraft:wooden_hoe',
    'azada_diamante': 'minecraft:diamond_hoe',
    'azada_hierro': 'minecraft:iron_hoe',
    'azada_madera': 'minecraft:wooden_hoe',
    'azada_oro': 'minecraft:golden_hoe',
    'azada_piedra': 'minecraft:stone_hoe',
    'azúcar': 'minecraft:sugar',
    'azúcar_comestible': 'minecraft:cake',
    'caña': 'minecraft:sugar_cane',
    'bloque_de_carbón': 'minecraft:coal_block',
    'bloque_de_cuarzo': 'minecraft:quartz_block',
    'bloque_de_diamante': 'minecraft:diamond_block',
    'bloque_de_emerald': 'minecraft:emerald_block',
    'bloque_de_hierro': 'minecraft:iron_block',
    'bloque_de_lapislázuli': 'minecraft:lapis_block',
    'bloque_de_netherita': 'minecraft:netherite_block',
    'bloque_de_oro': 'minecraft:gold_block',
    'bloque_de_redstone': 'minecraft:redstone_block',
    'bloque_de_slime': 'minecraft:slime_block',
    'bloque_de_piedra': 'minecraft:stone',
    'bloque_de_obsidiana': 'minecraft:obsidian',
    'bloque_de_terracota': 'minecraft:terracotta',
    'bloque_de_vidrio': 'minecraft:glass',
    'bloque_de_vidrio_tintado': 'minecraft:stained_glass',
    'bloque_de_vidrio_tintado_negro': 'minecraft:black_stained_glass',
    'bloque_de_vidrio_tintado_azul': 'minecraft:blue_stained_glass',
    'bloque_de_vidrio_tintado_verde': 'minecraft:green_stained_glass',
    'bloque_de_vidrio_tintado_rojo': 'minecraft:red_stained_glass',
    'bloque_de_vidrio_tintado_blanco': 'minecraft:white_stained_glass',
    'bloque_de_vidrio_tintado_amarillo': 'minecraft:yellow_stained_glass',
    'bloque_de_vidrio_tintado_gris': 'minecraft:gray_stained_glass',
    'bloque_de_vidrio_tintado_cyan': 'minecraft:cyan_stained_glass',
    'bloque_de_vidrio_tintado_magenta': 'minecraft:magenta_stained_glass',
    'bloque_de_vidrio_tintado_naranja': 'minecraft:orange_stained_glass',
    'bloque_de_vidrio_tintado_rosa': 'minecraft:pink_stained_glass',
    'bloque_de_vidrio_tintado_violeta': 'minecraft:purple_stained_glass',
    'bloque_de_vidrio_tintado_marrón': 'minecraft:brown_stained_glass',
    'bloque_de_vidrio_tintado_lima': 'minecraft:lime_stained_glass',
    'bloque_de_vidrio_tintado_claro': 'minecraft:light_gray_stained_glass',
    'bloque_de_vidrio_tintado_turquesa': 'minecraft:light_blue_stained_glass',
    'carbón': 'minecraft:coal',
    'carbón_de_madera': 'minecraft:charcoal',
    'carne': 'minecraft:beef',
    'carne_cocida': 'minecraft:cooked_beef',
    'carne_de_cerdo': 'minecraft:porkchop',
    'carne_de_cerdo_cocida': 'minecraft:cooked_porkchop',
    'carne_de_conejo': 'minecraft:rabbit',
    'carne_de_conejo_cocida': 'minecraft:cooked_rabbit',
    'carne_de_pollo': 'minecraft:chicken',
    'carne_de_pollo_cocida': 'minecraft:cooked_chicken',
    'carne_de_venado': 'minecraft:deer',
    'carne_de_venado_cocida': 'minecraft:cooked_deer',
    'caña_de_azúcar': 'minecraft:sugar_cane',
    'caña_de_bambú': 'minecraft:bamboo',
    'caña_de_pescar': 'minecraft:fishing_rod',
    'ceniza': 'minecraft:ashes',
    'cobre': 'minecraft:copper_ingot',
    'cobre_puro': 'minecraft:raw_copper_block',
    'cono_de_resina': 'minecraft:resin',
    'crema_de_magma': 'minecraft:magma_cream',
    'crisálida': 'minecraft:chorus_fruit',
    'cristal': 'minecraft:crystal',
    'cristal_de_amatista': 'minecraft:amethyst_crystal',
    'cristal_de_hielo': 'minecraft:packed_ice',
    'cristal_del_end': 'minecraft:end_crystal',
    'cristal_del_end_destruido': 'minecraft:dragon_breath',
    'cristal_del_nether': 'minecraft:nether_quartz',
    'cristal_del_nether_pulido': 'minecraft:polished_nether_quartz',
    'cristal_del_nether_bruto': 'minecraft:raw_nether_quartz',
    'cristal_del_nether_bruto_pulido': 'minecraft:polished_raw_nether_quartz',
    'cuarzo': 'minecraft:quartz',
    'cuenco': 'minecraft:bowl',
    'cuerda': 'minecraft:string',
    'cuerda_de_arco': 'minecraft:bow',
    'cuerda_de_redstone': 'minecraft:redstone',
    'cuerda_de_redstone_glow': 'minecraft:glowstone_dust',
    'cuerda_de_redstone_luz_de_mar': 'minecraft:sea_lantern',
    'cuerda_de_redstone_piedra_luminosa': 'minecraft:stone_luminite',
    'cuerda_de_redstone_antorcha_de_redstone': 'minecraft:redstone_torch',
    'diamante': 'minecraft:diamond',
    'diamante_bruto': 'minecraft:raw_diamond',
    'dorada': 'minecraft:gold_ingot',
    'dorada_bruta': 'minecraft:raw_gold',
    'dorada_del_nether': 'minecraft:nether_gold_ingot',
    'dorada_del_nether_bruta': 'minecraft:raw_nether_gold',
    'dorada_del_end': 'minecraft:end_gold_ingot',
    'dorada_del_end_bruta': 'minecraft:raw_end_gold',
    'dorada_del_rio': 'minecraft:river_gold_ingot',
    'dorada_del_rio_bruta': 'minecraft:raw_river_gold',
    'dorada_del_mar': 'minecraft:ocean_gold_ingot',
    'dorada_del_mar_bruta': 'minecraft:raw_ocean_gold',
    'dorada_del_cielo': 'minecraft:sky_gold_ingot',
    'dorada_del_cielo_bruta': 'minecraft:raw_sky_gold',
    'dorada_del_infierno': 'minecraft:hell_gold_ingot',
    'dorada_del_infierno_bruta': 'minecraft:raw_hell_gold',
    'dorada_del_espacio': 'minecraft:space_gold_ingot',
    'dorada_del_espacio_bruta': 'minecraft:raw_space_gold',
    'ender_perla': 'minecraft:ender_pearl',
    'ender_ojo': 'minecraft:ender_eye',
    'esmeralda': 'minecraft:emerald',
    'esmeralda_bruta': 'minecraft:raw_emerald',
    'enredadera': 'minecraft:vine',
    'escama_de_dragón': 'minecraft:dragon_scale',
    'escayola': 'minecraft:plaster',
    'escayola_blanca': 'minecraft:white_plaster',
    'escayola_naranja': 'minecraft:orange_plaster',
    'escayola_magenta': 'minecraft:magenta_plaster',
    'escayola_luz_azul': 'minecraft:light_blue_plaster',
    'escayola_amarilla': 'minecraft:yellow_plaster',
    'escayola_lima': 'minecraft:lime_plaster',
    'escayola_rosa': 'minecraft:pink_plaster',
    'escayola_gris': 'minecraft:gray_plaster',
    'escayola_luz_gris': 'minecraft:light_gray_plaster',
    'escayola_cian': 'minecraft:cyan_plaster',
    'escayola_purpura': 'minecraft:purple_plaster',
    'escayola_azul': 'minecraft:blue_plaster',
    'escayola_marron': 'minecraft:brown_plaster',
    'escayola_verde': 'minecraft:green_plaster',
    'escayola_roja': 'minecraft:red_plaster',
    'escayola_negra': 'minecraft:black_plaster',
    'flecha': 'minecraft:arrow',
    'flecha_fuego': 'minecraft:tipped_arrow',
    'flecha_perforadora': 'minecraft:pointed_dripstone_arrow',
    'flecha_espectral': 'minecraft:spectral_arrow',
    'flecha_del_end': 'minecraft:end_arrow',
    'flecha_del_nether': 'minecraft:nether_arrow',
    'fuego': 'minecraft:fire',
    'gato': 'minecraft:cat_spawn_egg',
    'goma': 'minecraft:slime_ball',
    'globo': 'minecraft:balloon',
    'galleta': 'minecraft:cookie',
    'huevo': 'minecraft:egg',
    'hormiga': 'minecraft:ant_spawn_egg',
    'hueso': 'minecraft:bone',
    'hacha': 'minecraft:axe',
    'hierro': 'minecraft:iron_ingot',
    'harina': 'minecraft:flour',
    'jaula': 'minecraft:cage',
    'jamon': 'minecraft:ham',
    'jardín': 'minecraft:garden',
    'kelp': 'minecraft:kelp',
    'koi': 'minecraft:koi_spawn_egg',
    'lana': 'minecraft:wool',
    'lapislázuli': 'minecraft:lapis_lazuli',
    'libro': 'minecraft:book',
    'linterna': 'minecraft:lantern',
    'leche': 'minecraft:milk_bucket',
    'manzana': 'minecraft:apple',
    'melón': 'minecraft:melon',
    'nabo': 'minecraft:beetroot',
    'nugget': 'minecraft:nugget',
    'nuez': 'minecraft:acorn',
    'berries': 'minecraft:sweet_berries',
    'llama': 'minecraft:llama_spawn_egg',
    'oro': 'minecraft:gold_ingot',
    'roca': 'minecraft:stone',
    'ramita': 'minecraft:stick',
    'ramo': 'minecraft:bouquet',
    'sal': 'minecraft:salt',
    'semilla': 'minecraft:seed',
    'tierra': 'minecraft:dirt',
    'tinta': 'minecraft:ink_sac',
    'uva': 'minecraft:grape',
    'vaca': 'minecraft:cow_spawn_egg',
    'zanahoria': 'minecraft:carrot',
    'zapato': 'minecraft:shoe',
    'zorro': 'minecraft:fox_spawn_egg',
    'resina': 'minecraft:resin',
    'magma': 'minecraft:magma_cream',
    'chorus': 'minecraft:chorus_fruit',
    'amatista': 'minecraft:amethyst_crystal',
    'hielo': 'minecraft:packed_ice',
    'end': 'minecraft:end_crystal',
    'nether': 'minecraft:nether_quartz',
    'nether_pulido': 'minecraft:polished_nether_quartz',
    'nether_bruto': 'minecraft:raw_nether_quartz',
    'nether_bruto_pulido': 'minecraft:polished_raw_nether_quartz',
    'cuarzo': 'minecraft:quartz',
    'hueso': 'minecraft:bone',
    'lana': 'minecraft:wool',
    'lapis': 'minecraft:lapis_lazuli',
    'libro': 'minecraft:book',
    'lanterna': 'minecraft:lantern',
    'leche': 'minecraft:milk_bucket',
    'nuez': 'minecraft:acorn',
    'berries': 'minecraft:sweet_berries',
    'roca': 'minecraft:stone',
    'semilla': 'minecraft:seed',
    'tierra': 'minecraft:dirt',
    'tinta': 'minecraft:ink_sac'
};
const keywordToMobMap = {
    'enderman': 'minecraft:enderman',
    'pig': 'minecraft:pig',
    'sheep': 'minecraft:sheep',
    'cow': 'minecraft:cow',
    'chicken': 'minecraft:chicken',
    'rabbit': 'minecraft:rabbit',
    'horse': 'minecraft:horse',
    'donkey': 'minecraft:donkey',
    'mule': 'minecraft:mule',
    'bat': 'minecraft:bat',
    'parrot': 'minecraft:parrot',
    'villager': 'minecraft:villager',
    'iron_golem': 'minecraft:iron_golem',
    'snow_golem': 'minecraft:snow_golem',
    'bee': 'minecraft:bee',
    'cat': 'minecraft:cat',
    'dog': 'minecraft:dog',
    'fox': 'minecraft:fox',
    'panda': 'minecraft:panda',
    'polar_bear': 'minecraft:polar_bear',
    'turtle': 'minecraft:turtle',
    'dolphin': 'minecraft:dolphin',
    'llama': 'minecraft:llama',
    'wolf': 'minecraft:wolf',
    'mooshroom': 'minecraft:mooshroom',
    // Agrega más palabras clave y mobs aquí
};

function handleEvent(eventType, data) {
    const words = chatMessage.split(' ');
    let commands = [];
    if (eventType === 'gift') {
        const giftName = data.giftName;
        if (commandGiftList.hasOwnProperty(giftName)) {
            commands = commandGiftList[giftName];
        } else {
            commands = commandGiftList['default'];
        }
    } else {
        if (commandList.hasOwnProperty(eventType)) {
            commands = commandList[eventType];
        } else {
            console.log(`No command assigned for event: ${eventType}`);
        }
    }

    // If the event is a chat event, check if the comment contains certain keywords
    if (eventType === 'chat') {
        const comment = data.comment.toLowerCase();

        for (const keyword in keywordToItemMap) {
            if (comment.includes(keyword)) {
                // If the comment contains a keyword, add a command to give the player the corresponding item
                commands.push(`/execute at ${playername} run give ${playername} ${keywordToItemMap[keyword]}`);
                console.log(`comando a palabra ${keyword}`);
            }
        }
        for (let word of words) {
            if (keywordToMobMap.hasOwnProperty(word)) {
                // Obtener el nombre del mob correspondiente
                const mobName = keywordToMobMap[word];
                commands.push(`execute at ${playername} run summon ${mobName}`);
            }
        }
    }

    commands = commands.map(command => {
        return command.replace('{uniqueId}', data.uniqueId || '')
            .replace('{comment}', data.comment || '')
            .replace('{message}', data.comment || '')
            .replace('{giftName}', data.giftName || '')
            .replace('{repeatCount}', data.repeatCount || '')
            .replace('{playername}', playername);
    });

    for (const command of commands) {
        sendCommand(command);
    }
}
// Function to send commands to the server
function sendCommand(command) {
    try {
        if (ws.readyState === WebSocket.OPEN) {
            let [commandName, ...messageParts] = command.split(' ');
            let message = messageParts.join(' ');

            if (commandName === '/say' && message.includes(':')) {
                let [uniqueId, ...restMessageParts] = message.split(':');
                let restMessage = restMessageParts.join(':');
                command = `/tellraw @a [{"text":"[${uniqueId}]","color":"gold"},{"text":"${restMessage}","color":"white"}]`;
            }

            ws.send(command);
            console.log(`Command sent`);
        } else {
            console.log('WebSocket is not open. Cannot send command:', command);
        }
    } catch (error) {
        console.error('Error sending command:', error);

    }
}

connectWebSocket();