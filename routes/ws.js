const getCronString = require('@darkeyedevelopers/natural-cron.js');
const schedule = require('node-schedule');
const fs = require('fs');
const logger = console;

const PULSE_WIDTH_CLOSED = 800;
const PULSE_WIDTH_OPEN = 2050;
const DURATION_OPEN = 1000;
const PHOTO_FILENAME = 'still';
const PHOTO_FILE_EXT = '.jpg';

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
        this.jobMap = new Map();
        this.latestStillShot = {
            dataUrl: null,
            timestamp: null
        };
    }

    init(GpioConstructor, camera, socketIO) {

        this.motor = new GpioConstructor(10, { mode: GpioConstructor.OUTPUT });
        this.camera = camera;

        //this.motor.servoWrite(PULSE_WIDTH_CLOSED);

        socketIO.on('connection', (socket) => {

            logger.info('WS Connection established.');

            socket.on('operation', (from, data) => this.onOperation(socket, from, data));

            setInterval(() => {
                socket.emit('server-status', {
                    timestamp: new Date().toLocaleString()
                });
            }, 5000);

            this.sendJobInfo(socket);
            this.sendLatestStillShot(socket);
        });
    }

    sendJobInfo(socket) {
        const jobInfos = [...this.jobMap.entries()].map(jobEntry => ({
            id: jobEntry[0],
            english: jobEntry[1].name,
            nextFeeding: new Date(jobEntry[1].nextInvocation()).toLocaleString()
        }));

        socket.emit('job-status', {
            timestamp: new Date().toLocaleString(),
            jobs: jobInfos
        });
    }

    async onOperation(socket, data) {
        logger.info(`Operation ${data.operation}`);

        if (data.operation === 'door-close') {
            this.doorClose(socket);

        } else if (data.operation === 'door-open') {
            this.doorOpen(socket);

        } else if (data.operation === 'feed-now') {
            await this.feedNow(socket, DURATION_OPEN);

        } else if (data.operation === 'add-job') {
            await this.scheduleCronJob(socket, data.english);

        } else if (data.operation === 'delete-job') {
            this.deleteJob(socket, data.jobId);

        } else if (data.operation === 'take-photo') {
            this.takePhoto(socket);

        } else {
            socket.emit('operation-status', {
                operation: data.operation,
                status: 'Unrecognized operation type.'
            });
        }
    }

    doorClose(socket, silent = false) {
        try {
            this.motor.servoWrite(PULSE_WIDTH_CLOSED);

            if (!silent) {
                socket.emit('operation-status', {
                    operation: 'door-close',
                    status: 'Door should be closed.',
                    timestamp: new Date().toLocaleString(),
                    complete: true
                });
            }
        } catch(e) {
            logger.error(e);

            socket.emit('operation-status', {
                operation: 'door-close',
                status: 'Door-closing Problem!: ' + e,
                timestamp: new Date().toLocaleString(),
                error: true
            });
        }
    }

    doorOpen(socket, silent = false) {
        try {
            this.motor.servoWrite(PULSE_WIDTH_OPEN);

            if (!silent) {
                socket.emit('operation-status', {
                    operation: 'door-open',
                    status: 'Door should be open.',
                    timestamp: new Date().toLocaleString(),
                    complete: true
                });
            }
        } catch(e) {
            logger.error(e);

            socket.emit('operation-status', {
                operation: 'door-open',
                status: 'Door-opening Problem!: ' + e,
                timestamp: new Date().toLocaleString(),
                error: true
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

            const time = new Date().toLocaleString();

            if (!silent) {
                socket.emit('operation-status', {
                    operation: 'feed-now',
                    status: 'Feeding Done!',
                    timestamp: time,
                    complete: true
                });
            }

            logger.info('Executing a feeding at ' + time);

            await promiseTimeout(2000);
            await this.takePhoto(socket);
        } catch(e) {
            logger.error(e);

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
            operation: 'add-job',
            status: 'Scheduling...',
            timestamp: new Date().toLocaleString(),
        });

        try {
            let cron = getCronString(english).replace('?', '*'); // the parser doesn't understand '?'.

            // Doesn't support seconds. but keeps returning 7 rather than 6 placeholders. Strip the last.
            cron = cron.substring(0, cron.lastIndexOf(' '));

            logger.info('Cron Job Translated to: ' + cron);

            const job = schedule.scheduleJob(english, cron, async () => {

                await this.feedNow(socket, DURATION_OPEN, true);

                socket.emit('operation-status', {
                    operation: 'run-job',
                    status: 'Feeding done. Next feeding at ' + new Date(job.nextInvocation()).toLocaleString(),
                    timestamp: new Date().toLocaleString(),
                    complete: true
                });

                this.sendJobInfo(socket);
            });

            job.english = english;
            this.jobMap.set(this.nextJobId++, job);

            socket.emit('operation-status', {
                operation: 'add-job',
                status: 'Scheduled. Next feeding at ' + new Date(job.nextInvocation()).toLocaleString(),
                timestamp: new Date().toLocaleString(),
                complete: true
            });
            this.sendJobInfo(socket);

        } catch(e) {
            logger.error(e);

            socket.emit('operation-status', {
                operation: 'add-job',
                status: 'Scheduling Problem!: ' + e,
                timestamp: new Date().toLocaleString(),
                error: true
            });
        }
    }

    deleteJob(socket, id) {
        socket.emit('operation-status', {
            operation: 'delete-job',
            status: 'Deleting...',
            timestamp: new Date().toLocaleString(),
        });

        try {
            const jobToDelete = this.jobMap.get(id);
            jobToDelete.cancel();   // cancel all future invocations.
            this.jobMap.delete(id); // Remove from our list.

            socket.emit('operation-status', {
                operation: 'delete-job',
                status: `Deleted Job "${jobToDelete.name}" (ID #${id})`,
                timestamp: new Date().toLocaleString(),
                complete: true
            });

            this.sendJobInfo(socket);

        } catch(e) {
            logger.error(e);

            socket.emit('operation-status', {
                operation: 'delete-job',
                status: 'Job Deletion Problem!: ' + e,
                timestamp: new Date().toLocaleString(),
                error: true
            });
        }
    }

    sendLatestStillShot(socket) {
        socket.emit('operation-status', {
            operation: 'latest-photo',
            status: 'Supplying latest photo.',
            latestPhoto: this.latestStillShot,
            timestamp: this.latestStillShot.timestamp,
            complete: true
        });
    }

    async takePhoto(socket) {

        socket.emit('operation-status', {
            operation: 'take-photo',
            status: 'Taking photo...',
            timestamp: new Date().toLocaleString()
        });

        try {
            const image = await this.camera.takeImage();

            const dt = new Date();
            let date = ("0" + dt.getDate()).slice(-2);
            let month = ("0" + (dt.getMonth() + 1)).slice(-2);
            let year = dt.getFullYear();
            let hours = dt.getHours();
            let minutes = dt.getMinutes();
            let seconds = dt.getSeconds();

            const filename = `${PHOTO_FILENAME}-${year}${month}${date}-${hours}${minutes}${seconds}${PHOTO_FILE_EXT}`;
            fs.writeFileSync(filename, image);

            const base64Image = fs.readFileSync(filename, { encoding: 'base64' });
            const dataUrl = 'data:image/jpeg;base64,' + base64Image;

            const timestamp = dt.toLocaleString();
            this.latestStillShot = { dataUrl, timestamp };

            socket.emit('operation-status', {
                operation: 'take-photo',
                status: 'Photo captured!',
                timestamp: timestamp,
                complete: true
            });

            this.sendLatestStillShot(socket);

            logger.info('Took a Photo at ' + timestamp);
        } catch(e) {
            logger.error(e);

            socket.emit('operation-status', {
                operation: 'take-photo',
                status: 'Photo problem!: ' + e,
                timestamp: new Date().toLocaleString(),
                error: true
            });
        }
    }

}

module.exports =  new WebsocketHandler();
