const logger = console;

const PULSE_WIDTH_OPEN = 800;
const PULSE_WIDTH_CLOSED = 2050;

function promiseTimeout(time) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            resolve(time);
        }, time);
    });
}

class WebsocketHandler {

    constructor() {
        this.motor = null;
    }

    init(GpioConstructor, socketIO) {

        this.motor = new GpioConstructor(10, { mode: GpioConstructor.OUTPUT });
        this.motor.servoWrite(PULSE_WIDTH_CLOSED);

        socketIO.on('connection', (socket) => {

            logger.info('WS Connection established.');

            socket.on('operation', (from, data) => this.onOperation(socket, from, data));

            setInterval(function () {
                socket.emit('server-status', { timestamp: new Date().toString() });
            }, 5000);

        });
    }

    onOperation(socket, data) {
        logger.info(`Operation ${data.operation}`);

        if (data.operation === 'feed-now') {
            socket.emit('operation-status', {
                operation: 'feed-now',
                status: 'Feeding...'
            });

            this.feedNow(data.duration).then(() => {
                return Promise.resolve(); //this.settle();
            }).then(() => {
                socket.emit('operation-status', {
                    operation: 'feed-now',
                    status: 'Feeding Done!'
                });
            }).catch((e) => {
                socket.emit('operation-status', {
                    operation: 'feed-now',
                    status: 'Feeding Problem!: ' + e
                });
            });

        } else {
            socket.emit('operation-status', {
                operation: data.operation,
                status: 'Unrecognized operation type.'
            });
        }
    }

    feedNow(duration) {
        return new Promise((resolve, reject) => {
            try {
                this.motor.servoWrite(PULSE_WIDTH_OPEN);
                setTimeout(() => {
                    this.motor.servoWrite(PULSE_WIDTH_CLOSED);
                    resolve();
                }, duration);
            } catch(e) {
                reject(e);
            }
        });
    }

}

module.exports =  new WebsocketHandler();
