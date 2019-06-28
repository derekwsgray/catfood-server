const getCronString = require('@darkeyedevelopers/natural-cron.js');
const schedule = require('node-schedule');
const logger = console;

const PULSE_WIDTH_OPEN = 800;
const PULSE_WIDTH_CLOSED = 2050;
const DURATION_OPEN = 1000;

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
        this.nextJobId = 1;
        this.jobMap = {};
    }

    init(GpioConstructor, socketIO) {

        this.motor = new GpioConstructor(10, { mode: GpioConstructor.OUTPUT });
        this.motor.servoWrite(PULSE_WIDTH_CLOSED);

        socketIO.on('connection', (socket) => {

            logger.info('WS Connection established.');

            socket.on('operation', (from, data) => this.onOperation(socket, from, data));

            setInterval(function () {
                socket.emit('server-status', { timestamp: new Date().toLocaleString() });
            }, 5000);

        });
    }

    async onOperation(socket, data) {
        logger.info(`Operation ${data.operation}`);

        if (data.operation === 'feed-now') {
            await this.feedNow(socket, DURATION_OPEN);

        } else if (data.operation === 'cron-job') {
            await this.scheduleCronJob(socket, data.english);

        } else {
            socket.emit('operation-status', {
                operation: data.operation,
                status: 'Unrecognized operation type.'
            });
        }
    }

    async feedNow(socket, duration, silent = false) {
        socket.emit('operation-status', {
            operation: 'feed-now',
            status: 'Feeding...',
            timestamp: new Date().toLocaleString()
        });

        try {
            this.motor.servoWrite(PULSE_WIDTH_OPEN);
            await promiseTimeout(duration);
            this.motor.servoWrite(PULSE_WIDTH_CLOSED);

            if (!silent) {
                socket.emit('operation-status', {
                    operation: 'feed-now',
                    status: 'Feeding Done!',
                    timestamp: new Date().toLocaleString(),
                    complete: true
                });
            }
        } catch(e) {
            socket.emit('operation-status', {
                operation: 'feed-now',
                status: 'Feeding Problem!: ' + e,
                timestamp: new Date().toLocaleString(),
                error: true
            });
        }
    }

    /**
     * The cron format consists of:
     *
     *  *    *    *    *    *    *
     *  ┬    ┬    ┬    ┬    ┬    ┬
     *  │    │    │    │    │    │
     *  │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
     *  │    │    │    │    └───── month (1 - 12)
     *  │    │    │    └────────── day of month (1 - 31)
     *  │    │    └─────────────── hour (0 - 23)
     *  │    └──────────────────── minute (0 - 59)
     *  └───────────────────────── second (0 - 59, OPTIONAL)
     * @param socket
     * @param english
     */
    scheduleCronJob(socket, english) {
        socket.emit('operation-status', {
            operation: 'cron-job',
            status: 'Scheduling...'
            timestamp: new Date().toLocaleString(),
        });

        try {
            let cron = getCronString(english).replace('?', '*'); // the parser doesn't understand '?'.

            // Doesn't support seconds. so...
            //if (cron.split(' ').length < 6) {
                cron = cron.substring(0, cron.lastIndexOf(' '));
            //}

            logger.info('Cron Job Translated to: ' + cron);

            const job = schedule.scheduleJob(cron, async () => {

                await this.feedNow(socket, DURATION_OPEN, true);

                socket.emit('operation-status', {
                    operation: 'cron-job',
                    status: 'Feeding done. Next feeding at ' + new Date(job.nextInvocation()).toLocaleString(),
                    timestamp: new Date().toLocaleString(),
                    complete: true
                });
            });
            this.jobMap[this.nextJobId++] = job;

            //const nextExecution = cronParser.parseExpression(cron, { tz: 'America/Toronto' }).next().toString();

            socket.emit('operation-status', {
                operation: 'cron-job',
                status: 'Scheduled. Next feeding at ' + new Date(job.nextInvocation()).toLocaleString(),
                timestamp: new Date().toLocaleString(),
                complete: true
            });

        } catch(e) {
            socket.emit('operation-status', {
                operation: 'cron-job',
                status: 'Scheduling Problem!: ' + e,
                timestamp: new Date().toLocaleString(),
                error: true
            });
        }


    }

}

module.exports =  new WebsocketHandler();
