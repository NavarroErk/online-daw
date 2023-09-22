import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Howl } from 'howler';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
//import { faRecord } from '@fortawesome/free-solid-svg-icons/faRecord';
import { faPlay, faPause, faStop, faTrash, faUndo, faRedo, faRecordVinyl, fastart} from '@fortawesome/free-solid-svg-icons';

import './App.css';

function App() {
  const [tracks, setTracks] = useState([]);
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const mediaRecorderRef = useRef(null);
  const playbackIntervalRef = useRef(null);

  const [audioChunks, setAudioChunks] = useState([]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTrackId, isRecording, isPlaying, playbackPosition, tracks, undoStack, redoStack]);

  function handleKeyDown(event) {
    if (event.code === 'Space') {
      event.preventDefault();
      if (isPlaying) {
        pausePlayback();
      } else {
        startPlayback();
      }
    } else if (event.code === 'KeyR') {
      event.preventDefault();
      toggleRecording();
    } else if (event.code === 'KeyZ' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
  }

  function addTrack() {
    const newTrack = {
      id: uuidv4(),
      name: `Track ${tracks.length + 1}`,
      audioChunks: [],
      volume: 1,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      effects: [],
    };
    setTracks([...tracks, newTrack]);
    setActiveTrackId(newTrack.id);
  }

  function removeTrack(trackId) {
    setTracks(tracks.filter(track => track.id !== trackId));
    setActiveTrackId(null);
  }

  function toggleRecording() {
    if (!navigator.mediaDevices) {
      alert("Your browser doesn't support audio recording.");
      return;
    }

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      startRecording();
    } else {
      stopRecording();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error(error);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }

  function handleDataAvailable(event) {
    if (event.data.size > 0) {
      setAudioChunks((chunks) => [...chunks, event.data]);
    }
  }

  function startPlayback() {
    if (!activeTrackId) {
      return;
    }

    const activeTrack = tracks.find(track => track.id === activeTrackId);
    const audioUrl = URL.createObjectURL(new Blob(activeTrack.audioChunks));
    const sound = new Howl({
      src: [audioUrl],
      format: 'webm',
      onload: () => {
        setIsPlaying(true);
        playbackIntervalRef.current = setInterval(() => {
          setPlaybackPosition(sound.seek() * 1000);
        }, 50);
      },
      onend: () => {
        setIsPlaying(false);
        setPlaybackPosition(0);
        clearInterval(playbackIntervalRef.current);
      },
    });
    sound.play();
  }

  function pausePlayback() {
    const activeTrack = tracks.find(track => track.id === activeTrackId);
    const sound = Howl._howls.find(howl => howl._src === URL.createObjectURL(new Blob(activeTrack.audioChunks)));
    sound.pause();
    setIsPlaying(false);
    clearInterval(playbackIntervalRef.current);
  }

  function stopPlayback() {
    const activeTrack = tracks.find(track => track.id === activeTrackId);
    const sound = Howl._howls.find(howl => howl._src === URL.createObjectURL(new Blob(activeTrack.audioChunks)));
    sound.stop();
    setIsPlaying(false);
    setPlaybackPosition(0);
    clearInterval(playbackIntervalRef.current);
  }

  function undo() {
    if (undoStack.length === 0) {
      return;
    }

    const lastAction = undoStack.pop();
    setRedoStack([...redoStack, lastAction]);

    switch (lastAction.type) {
      case 'RECORD':
        const activeTrackIndex = tracks.findIndex(track => track.id === activeTrackId);
        const activeTrack = tracks[activeTrackIndex];
        const audioChunks = activeTrack.audioChunks.slice(0, -1);
        const newTrack = { ...activeTrack, audioChunks };
        setTracks([...tracks.slice(0, activeTrackIndex), newTrack, ...tracks.slice(activeTrackIndex + 1)]);
        break;
      case 'ADD_TRACK':
        setTracks(tracks.filter(track => track.id !== lastAction.trackId));
        setActiveTrackId(null);
        break;
      case 'REMOVE_TRACK':
        setTracks([...tracks, lastAction.track]);
        setActiveTrackId(lastAction.track.id);
        break;
      default:
        break;
    }
  }

  function redo() {
    if (redoStack.length === 0) {
      return;
    }

    const lastAction = redoStack.pop();
    setUndoStack([...undoStack, lastAction]);

    switch (lastAction.type) {
      case 'RECORD':
        const activeTrackIndex = tracks.findIndex(track => track.id === activeTrackId);
        const activeTrack = tracks[activeTrackIndex];
        const audioChunks = [...activeTrack.audioChunks, lastAction.audioChunk];
        const updatedTrack = { ...activeTrack, audioChunks };
        setTracks([...tracks.slice(0, activeTrackIndex), updatedTrack, ...tracks.slice(activeTrackIndex + 1)]);
        break;
      case 'ADD_TRACK':
        const newTrackObj = { ...lastAction.track };
        setTracks([...tracks, newTrackObj]);
        setActiveTrackId(newTrackObj.id);
        break;
      case 'REMOVE_TRACK':
        setTracks(tracks.filter(track => track.id !== lastAction.trackId));
        setActiveTrackId(null);
        break;
      default:
        break;
    }
  }

  function handleVolumeChange(trackId, volume) {
    const trackIndex = tracks.findIndex(track => track.id === trackId);
    const track = tracks[trackIndex];
    const newTrack = { ...track, volume };
    setTracks([...tracks.slice(0, trackIndex), newTrack, ...tracks.slice(trackIndex + 1)]);
  }

  function handlePanChange(trackId, pan) {
    const trackIndex = tracks.findIndex(track => track.id === trackId);
    const track = tracks[trackIndex];
    const newTrack = { ...track, pan };
    setTracks([...tracks.slice(0, trackIndex), newTrack, ...tracks.slice(trackIndex + 1)]);
  }

  function toggleMute(trackId) {
    const trackIndex = tracks.findIndex(track => track.id === trackId);
    const track = tracks[trackIndex];
    const newTrack = { ...track, isMuted: !track.isMuted };
    setTracks([...tracks.slice(0, trackIndex), newTrack, ...tracks.slice(trackIndex + 1)]);
  }

  function toggleSolo(trackId) {
    const trackIndex = tracks.findIndex(track => track.id === trackId);
    const track = tracks[trackIndex];
    const newTrack = { ...track, isSoloed: !track.isSoloed };
    setTracks([...tracks.slice(0, trackIndex), newTrack, ...tracks.slice(trackIndex + 1)]);
  }

  function addEffect(trackId, effect) {
    const trackIndex = tracks.findIndex(track => track.id === trackId);
    const track = tracks[trackIndex];
    const newTrack = { ...track, effects: [...track.effects, effect] };
    setTracks([...tracks.slice(0, trackIndex), newTrack, ...tracks.slice(trackIndex + 1)]);
  }

  function removeEffect(trackId, effectIndex) {
    const trackIndex = tracks.findIndex(track => track.id === trackId);
    const track = tracks[trackIndex];
    const effects = [...track.effects.slice(0, effectIndex), ...track.effects.slice(effectIndex + 1)];
    const newTrack = { ...track, effects };
    setTracks([...tracks.slice(0, trackIndex), newTrack, ...tracks.slice(trackIndex + 1)]);
  }

  function clearUndoRedoStacks() {
    setUndoStack([]);
    setRedoStack([]);
  }

  return (
    <div className="App">
      <header>
        <h1>Digital Audio Workstation</h1>
        <button onClick={addTrack}>Add Track</button>
      </header>
      <main>
        <div className="tracks">
          {tracks.map(track => (
            <div
              key={track.id}
              className={`track ${track.id === activeTrackId ? 'active' : ''} ${track.isMuted ? 'muted' : ''} ${track.isSoloed ? 'soloed' : ''}`}
            >
              <div className="track-header">
                <h2>{track.name}</h2>
                <div className="track-controls">
                  <button onClick={() => setActiveTrackId(track.id)}>
                    <FontAwesomeIcon icon={faPlay} />
                  </button>
                  <button onClick={pausePlayback}>
                    <FontAwesomeIcon icon={faPause} />
                  </button>
                  <button onClick={stopPlayback}>
                    <FontAwesomeIcon icon={faStop} />
                  </button>
                  <button onClick={toggleRecording}>
                    <FontAwesomeIcon icon={faRecordVinyl} />
                  </button>
                  <button onClick={() => removeTrack(track.id)}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                  <button onClick={undo} disabled={undoStack.length === 0}>
                    <FontAwesomeIcon icon={faUndo} />
                  </button>
                  <button onClick={redo} disabled={redoStack.length === 0}>
                    <FontAwesomeIcon icon={faRedo} />
                  </button>
                </div>
              </div>
              <div className="track-body">
                <div className="track-volume">
                  <label htmlFor={`volume-${track.id}`}>Volume:</label>
                  <input
                    type="range"
                    id={`volume-${track.id}`}
                    min="0"
                    max="1"
                    step="0.01"
                    value={track.volume}
                    onChange={event => handleVolumeChange(track.id, parseFloat(event.target.value))}
                  />
                </div>
                <div className="track-pan">
                  <label htmlFor={`pan-${track.id}`}>Pan:</label>
                  <input
                    type="range"
                    id={`pan-${track.id}`}
                    min="-1"
                    max="1"
                    step="0.01"
                    value={track.pan}
                    onChange={event => handlePanChange(track.id, parseFloat(event.target.value))}
                  />
                </div>
                <div className="track-effects">
                  <h3>Effects:</h3>
                  <ul>
                    {track.effects.map((effect, index) => (
                      <li key={index}>
                        {effect.name}
                        <button onClick={() => removeEffect(track.id, index)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="track-footer">
                <button onClick={() => toggleMute(track.id)}>{track.isMuted ? 'Unmute' : 'Mute'}</button>
                <button onClick={() => toggleSolo(track.id)}>{track.isSoloed ? 'Unsolo' : 'Solo'}</button>
                <button onClick={() => addEffect(track.id, { name: 'Reverb' })}>Add Reverb</button>
                <button onClick={() => addEffect(track.id, { name: 'Delay' })}>Add Delay</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
