import flask
import flask_cors
import io
import re
import json
from base64 import b64decode

app = flask.Flask(__name__)
flask_cors.CORS(app)

@app.route('/process', methods=['POST', 'OPTIONS'])
def predict():
    if flask.request.method != 'POST':
        return ''

    data_prefix = "data:audio/wav;base64,"
    base64_wav = flask.request.form['wav'][len(data_prefix):]
    wav_file = open('audio.wav', 'wb')
    wav_file.write(bytearray(b64decode(base64_wav)))
    # wav_file.write(base64_wav)
    wav_file.close()
    
    return ''
