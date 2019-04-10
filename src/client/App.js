/*
  REFERENCES:
  https://blog.sambego.be/creating-an-audio-waveform-from-your-microphone-input/
  https://typedarray.org/from-microphone-to-wav-with-getusermedia-and-web-audio/
*/

import React, { Component } from 'react';
import './app.css';

const APP_NAME = 'wix4podcaster';

/*
  From the spec: This value controls how frequently the audioprocess event is 
  dispatched and how many sample-frames need to be processed each call. 
  Lower values for buffer size will result in a lower (better) latency. 
  Higher values will be necessary to avoid audio breakup and glitches 
*/
const BUFFER_SIZE = 2048;

const getAverageVolume = array => {
  const length = array.length;
  let values = 0;

  for (let i = 0; i < length; i++) {
    values += array[i];
  }

  return values / length;
};

const mergeBuffers = (channelBuffer, recordingLength) => {
  const result = new Float32Array(recordingLength);
  let offset = 0;
  const length = channelBuffer.length;

  for (let i = 0; i < length; i++) {
    const buffer = channelBuffer[i];
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
};

const interleave = (leftChannel, rightChannel) => {
  const length = leftChannel.length + rightChannel.length;
  const result = new Float32Array(length);

  let inputIndex = 0;

  for (let index = 0; index < length; ) {
    result[index++] = leftChannel[inputIndex];
    result[index++] = rightChannel[inputIndex];
    inputIndex++;
  }

  return result;
};

const writeUTFBytes = (view, offset, string) => {
  const length = string.length;

  for (let i = 0; i < length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

export default class App extends Component {
  state = {
    view: 'start',
    bars: [],
    timestamp: 0
  };

  constructor(props) {
    super(props);

    this._resetAudioState();

    this._onClickRecord = this._onClickRecord.bind(this);
    this._onClickStop = this._onClickStop.bind(this);
    this._handleMicStream = this._handleMicStream.bind(this);
    this._processAudioInput = this._processAudioInput.bind(this);
  }

  _resetAudioState() {
    this._analyser = null;
    this._stream = null;
    this._sampleRate = null;
    this._leftChannel = [];
    this._rightChannel = [];
    this._recordingLength = 0;
  }
  
  componentDidMount() {
/*    fetch('/api/getUsername')
      .then(res => res.json())
      .then(({ username }) => this.setState({ username }));
*/
  }

  _onClickRecord() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(this._handleMicStream)
      .catch(e => {
        console.log(e);
      });
  }

  _onClickStop() {
    this._stream.getTracks().forEach(track => track.stop());
    this._stream = null;
    this.setState({
      view: 'local-processing'
    });

    const wavBlob = this._generateRecordedWAV();

    this.setState({
      view: 'uploading-audio'
    });

    const reader = new FileReader();
    reader.addEventListener('loadend', () => {
      const formData = new FormData();
      formData.append('wav', reader.result);

      fetch('http://127.0.0.1:5000/process', { method: 'POST', body: formData });
      // fetch('http://10.48.1.175:5000/process', { method: 'POST', body: formData });

      // reader.removeEventListener('loadend');
    });

    reader.readAsDataURL(wavBlob);
  }

  _handleMicStream(stream) {    
    const audioContext = new AudioContext();
    const volume = audioContext.createGain();
    const audioInput = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const scriptProcessor = audioContext.createScriptProcessor(); // BUFFER_SIZE, 2, 2);

    this._stream = stream;
    this._analyser = analyser;
    this._sampleRate = audioContext.sampleRate;

    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = BUFFER_SIZE;

    audioInput.connect(volume);
    volume.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);
    
    scriptProcessor.onaudioprocess = this._processAudioInput;

    this.setState({
      view: 'recording'
    });
  }

  _processAudioInput(audioProcessingEvent) {
    if (this._stream === null) {
      return;
    }

    // const inputBuffer = audioProcessingEvent.inputBuffer;
    // const outputBuffer = audioProcessingEvent.outputBuffer;

    const leftChannelData = audioProcessingEvent.inputBuffer.getChannelData(0);
    const rightChannelData = audioProcessingEvent.inputBuffer.getChannelData(1);
    
    this._leftChannel.push(new Float32Array(leftChannelData));
    this._rightChannel.push(new Float32Array(rightChannelData));
    this._recordingLength += BUFFER_SIZE;
    
    // for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
    //   const inputData = inputBuffer.getChannelData(channel);
    //   // const outputData = outputBuffer.getChannelData(channel);

    //   console.log(JSON.stringify(inputData));
    //   // for (let sample = 0; sample < inputBuffer.length; sample++) {
    //   //  outputData[sample] += ((Math.random() * 2) - 1) * 0.2;         
    //   // }
    // }
    
    const tempArray = new Uint8Array(this._analyser.frequencyBinCount);
    this._analyser.getByteFrequencyData(tempArray);

    this.setState(prevState => {
      let bars = prevState.bars.slice();
      bars.push(getAverageVolume(tempArray));

      if (bars.length > 5) {
        bars = bars.slice(1);
      }

      return {
        bars,
        timestamp: audioProcessingEvent.playbackTime
      };
    });
  }

  _generateRecordedWAV() {
    const leftBuffer = mergeBuffers(this._leftChannel, this._recordingLength);
    const rightBuffer = mergeBuffers(this._rightChannel, this._recordingLength);
    const interleaved = interleave(leftBuffer, rightBuffer);
    const buffer = new ArrayBuffer(44 + interleaved.length * 2);
    const view = new DataView(buffer);

    // write the WAV container, check spec at: https://ccrma.stanford.edu/courses/422/projects/WaveFormat/
    // RIFF chunk descriptor
    writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 44 + interleaved.length * 2, true);
    writeUTFBytes(view, 8, 'WAVE');

    // FMT sub-chunk
    writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);

    // stereo (2 channels)
    view.setUint16(22, 2, true);
    view.setUint32(24, this._sampleRate, true);
    view.setUint32(28, this._sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);

    // data sub-chunk
    writeUTFBytes(view, 36, 'data');
    view.setUint32(40, interleaved.length * 2, true);

    // write the PCM samples
    const length = interleaved.length;
    let index = 44;
    let volume = 1;
    for (let i = 0; i < length; i++) {
      view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
      index += 2;
    }

    return new Blob([view], {type: 'audio/wav'});
  }

  _renderHeader() {
    switch (this.state.view) {
    case 'start':
    case 'recording':
    case 'local-processing':
    case 'uploading-audio':
    default:
      return (
        <div id="app-name">{APP_NAME}</div>
      );
      break;
    }
  }

  _renderMainView() {
    switch (this.state.view) {
    case 'start':
      return (
        <div />
      );
      break;

    case 'recording':
      if (this.state.bars.length === 0) {
        return <div />;
      }

      const maxVolume = 120;
      const volume = this.state.bars[this.state.bars.length - 1];
      const svgHeight = '80vh';
      const barWidth = 4;

      return (
        <div>
          <svg className="svg" width="100%" height={svgHeight}>
            {
              this.state.bars.map(volume => (
                <circle
                  cx="50%"
                  cy="50%"
                  r={"calc(" + svgHeight + " * " + (volume / maxVolume / 2) + ")"}
                  stroke-width="0"
                  fill={"rgba(50, 205, 50, " + (volume / maxVolume) + ")"}
                />
              ))
            }
            <rect
              fill="#fff"
              width={barWidth + "px"}
              height={(volume / 2) + "px"}
              x={"calc(50% - " + (barWidth / 2 + 16) + "px)"}
              y={"calc(50% - " + (volume / 4) + "px)"}
            />
            <rect
              fill="#fff"
              width={barWidth + "px"}
              height={volume + "px"}
              x={"calc(50% - " + (barWidth / 2) + "px)"}
              y={"calc(50% - " + (volume / 2) + "px)"}
            />
            <rect
              fill="#fff"
              width={barWidth + "px"}
              height={(volume / 2) + "px"}
              x={"calc(50% - " + (barWidth / 2 - 16) + "px)"}
              y={"calc(50% - " + (volume / 4) + "px)"}
            />
          </svg>
        </div>
      );
      break;

    case 'local-processing':
      return (
        <div>Generating audio data...</div>
      );
      break;

    case 'uploading-audio':
      return (
        <div>Uploading audio data...</div>
      );
      break;
    }

    return null;
  }
  
  _renderFooter() {
    switch (this.state.view) {
    case 'start':
      return (
        <button id="record" type="button" onClick={this._onClickRecord}>
          {'\uD83D\uDD34'} Record
        </button>
      );
      break;
    case 'recording':
      return (
        <div>
          <button id="stop" type="button" onClick={this._onClickStop}>
            {'\uD83D\uDED1'} Stop
          </button>
          <span id="timestamp">{this.state.timestamp.toFixed(2) + 's'}</span>
        </div>
      );
      break;
    case 'local-processing':
    case 'uploading-audio':
      return (
        <div>
          <span id="timestamp">{this.state.timestamp.toFixed(2) + 's'}</span>
        </div>
      );
      break;
    }

    return null;
  }

  render() {
    const { username } = this.state;

    const header = this._renderHeader();
    const mainView = this._renderMainView();
    const footer = this._renderFooter();
    
    return (
      <div>
        <header>{header}</header>
        <main>{mainView}</main>
        <footer>{footer}</footer>
      </div>
    );
  }
}
