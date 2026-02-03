const EventEmitter = require('events');
class Broadcaster extends EventEmitter {}
const broadcaster = new Broadcaster();

// Helper to register SSE clients
const sseClients = new Set();

function registerSSE(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.write('\n');
    const onNew = (data) => {
        try {
            res.write(`event: audit\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (e) {}
    };
    broadcaster.on('new_audit', onNew);
    const onUpdate = (data) => {
        try {
            res.write(`event: audit_update\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (e) {}
    };
    broadcaster.on('update_audit', onUpdate);
    // Remove when client disconnects
    req.on('close', () => {
        broadcaster.removeListener('new_audit', onNew);
        broadcaster.removeListener('update_audit', onUpdate);
    });
}

module.exports = { broadcaster, registerSSE };
