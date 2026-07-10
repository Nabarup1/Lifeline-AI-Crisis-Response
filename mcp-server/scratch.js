fetch('https://geocoding-api.open-meteo.com/v1/search?name=Los%20Angeles,%20CA&count=1&language=en&format=json').then(r => r.json()).then(console.log);
fetch('https://geocoding-api.open-meteo.com/v1/search?name=Los%20Angeles&count=1&language=en&format=json').then(r => r.json()).then(console.log);
