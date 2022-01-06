(function(cb) {
    window.addEventListener('load', cb);
}(function() {
    const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

    Tesseract.setLogging(true);

    const statuses = {};

    async function detect(buffer) {
        const worker = Tesseract.createWorker({
            logger: update,
        });

        await worker.load();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');

        const result = await worker.recognize(buffer);
        console.log(result.data);

        const method = document.querySelector('input[name="method"]:checked');
        console.log(method);
        display(result.data.text, method.value);

        await worker.terminate();
    }

    async function update(message) {
        console.log(message);

        const status = document.getElementById('status');
        status.innerHTML = '';

        if (!message) {
            Object.assign(statuses, {});
        }
        else if (typeof message === 'string') {
            status.insertAdjacentHTML('beforeend', `<div>${message}</div>`);
        }
        else {
            const percent = (message.progress * 100).toFixed(0);
            statuses[message.userJobId] = `${message.status} - ${percent}%`;

            for (let item of Object.values(statuses)) {
                status.insertAdjacentHTML('beforeend', `<div>${item}</div>`);
            }
        }
    }

    /**
     *
     * @param {string} data
     * @param {string} method
     */
    function display(data, method) {
        const table = [];

        if (method === 'binary') {
            let word = 0;
            let offset = 0;

            for (let char in data.split('')) {
                switch (char) {
                    case '0':
                        word |= 1 << offset++;
                        break;

                    case '1':
                        offset++;
                        break;
                }
                if (offset == 8) {
                    table.push(word);
                    offset = 0;
                    word = 0;
                }
            }
        }
        else if (method === 'hex') {
            for (let char of data.split('')) {
                table.push(parseInt(char, 16));
            }
        }
        else if (method === 'base64') {
            data = data
                .split('')
                .filter(char => BASE64.indexOf(char) !== -1)
                .join('');
            data = atob(data);

            for (let word of data.split('')) {
                table.push(word.charCodeAt(0));
            }
        }
        // ascii.
        else {
            for (let char of data.split('')) {
                table.push(char.charCodeAt(0));
            }
        }

        console.log(table);

        const grid = document.getElementById('grid');
        grid.innerHTML = '';

        for (let i = 0; i < table.length; i += 16) {
            const chunk = table.slice(i, i + 16);

            const row = document.createElement('tr');

            // Hex formatted address.
            const address = i.toString(16).padStart(8, '0');
            row.insertAdjacentHTML('beforeend', `<td>${address}</td>`);

            // Hex words.
            for (let j = 0; j < 16; j++) {
                let word = (chunk[j] || 0) & 0xFF;
                word = word.toString(16);

                let id = 'd' + (i + j);
                row.insertAdjacentHTML('beforeend', `<td item='${id}'>${word}</td>`);
            }

            // Ascii characters.
            for (let j = 0; j < 16; j++) {
                let word = chunk[j] || 0;
                word = (word >= 32 && word < 127) ? String.fromCharCode(word) : '.';

                let id = 'd' + (i + j);
                row.insertAdjacentHTML('beforeend', `<td item='${id}'>${word}</td>`);
            }

            grid.insertAdjacentElement('beforeend', row);
        }
    }

    async function main() {
        const canvas = document.getElementById('canvas');
        const video = document.getElementById('video');
        const startButton = document.getElementById('snap');
        const resetButton = document.getElementById('reset');
        const grid = document.getElementById('grid');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
        });

        // Start the video stream.
        video.srcObject = stream;
        video.play();

        const context = canvas.getContext('2d');

        // On 'capture', clear the output + perform OCR on the text.
        startButton.addEventListener('click', async function() {
            startButton.disabled = true;
            update('');

            video.pause();
            context.drawImage(video, 0, 0, 640, 480);

            try {
                await detect(canvas);
            }
            catch (e) {
                console.error(e);
                update(e.message);
            }
        });

        resetButton.addEventListener('click', function() {
            update('');
            display('\x00', 'ascii');
            startButton.disabled = false;
            video.play();
        });

        grid.addEventListener('mouseover', function(event) {
            const id = event.target.getAttribute('item');
            if (!id) return;

            for (let element of document.querySelectorAll(`[item='${id}']`)) {
                element.classList.add('highlight');
            }
        });

        grid.addEventListener('mouseout', function(event) {
            const id = event.target.getAttribute('item');
            if (!id) return;

            for (let element of document.querySelectorAll(`[item='${id}']`)) {
                element.classList.remove('highlight');
            }
        });
    }

    main();
    display('\x00', 'ascii');
}));
