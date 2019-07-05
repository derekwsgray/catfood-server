const request = require('request-promise-native');
const fs = require('fs');

class StillCamera {

    async takeImage() {
        let image = null;
        await request({
            url: 'https://picsum.photos/200/300',
            method: 'get',
            encoding: null
        }).then((body) => {
            image = body;
        });
        return image;
    }

}

module.exports = StillCamera;
