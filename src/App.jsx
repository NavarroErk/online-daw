import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Howl } from 'howler';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faStop, faTrash, faUndo, faRedo, faRecordVinyl, faPlus } from '@fortawesome/free-solid-svg-icons';

import './App.css';

function App() {
  const [tracks, setTracks] = useState([]);
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [deviceIds, setDeviceIds] = useState({});
  const [devices, setDevices] = useState([]);

  const mediaRecorderRef = useRef(null);
  const playbackIntervalRef = useRef(null);

  const [audioChunks, setAudioChunks] = useState([]);

  navigator.mediaDevices.enumerateDevices().then((devices) => {
    const audioDevices = devices.filter((device) => device.kind === 'audioinput');
    if (audioDevices.length > 0) {
      setDeviceIds((deviceIds) => {
        const newDeviceIds = { ...deviceIds };
        tracks.forEach((track) => {
          if (!newDeviceIds[track.id]) {
            newDeviceIds[track.id] = audioDevices[0].deviceId;
          }
        });
        return newDeviceIds;
      });
    }
  });

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      const audioDevices = allDevices.filter(device => device.kind === 'audioinput');
      setDevices(audioDevices);
      
      if (window.stream) {
        setTracks((tracks) => tracks.map((track) => {
          if (deviceIds[track.id]) {
            return {
              ...track,
              audio: new Howl({
                src: URL.createObjectURL(new Blob(track.audioChunks)),
                html5: true,
                volume: 1.0,
                onend: () => {
                  setIsPlaying(false);
                  setPlaybackPosition(0);
                },
              }),
            };
          } else {
            return track;
          }
        }));
      }
    });
}, []); // empty dependency array ensures this runs only once


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
    } else if (event.code === 'KeyS') {
      event.preventDefault();
      stopPlayback();
    } else if (event.code === 'KeyZ' && event.ctrlKey) {
      event.preventDefault();
      undo();
    } else if (event.code === 'KeyY' && event.ctrlKey) {
      event.preventDefault();
      redo();
    } else if (event.code === 'Delete') {
      event.preventDefault();
      deleteActiveTrack();
    }
  }

  function toggleRecording(trackId) {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(trackId);
    }
  }

  function startRecording(trackId, deviceId) {

    console.log('startRecording', trackId, deviceId);
    setIsRecording(true);
    setAudioChunks([]);
    navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId } })
      .then((stream) => {
        console.log('getUserMedia success');
        window.stream = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
        mediaRecorderRef.current.start();
        setActiveTrackId(trackId);
      })
      .catch((error) => {
        console.error('Error accessing microphone:', error);
      });
  }

  function stopRecording() {
    console.log('stopRecording');
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    const newTrack = {
      id: uuidv4(),
      name: `Track ${tracks.length + 1}`,
      duration: formatDuration(audioChunks.length * 100),
      audioChunks: audioChunks,
    };
    setTracks((tracks) =>
      tracks.map((track) => {
        if (track.id === activeTrackId) {
          return newTrack;
        } else {
          return track;
        }
      })
    );
    setUndoStack((stack) => [
      ...stack,
      { type: 'edit', trackId: activeTrackId, newTrack: newTrack },
    ]);
    setRedoStack([]);
    setActiveTrackId(null);
  }

  function handleDataAvailable(event) {
    setAudioChunks((chunks) => [...chunks, event.data]);
  }

  function startPlayback() {
    console.log('startPlayback');
    if (!activeTrackId) {
      setActiveTrackId(tracks[0].id);
    }
    setIsPlaying(true);
    playbackIntervalRef.current = setInterval(() => {
      setPlaybackPosition((position) => position + 100);
    }, 100);
  }

  function pausePlayback() {
    console.log('pausePlayback');
    setIsPlaying(false);
    clearInterval(playbackIntervalRef.current);
  }

  function stopPlayback() {
    console.log('stopPlayback');
    setIsPlaying(false);
    setPlaybackPosition(0);
    clearInterval(playbackIntervalRef.current);
  }

  function undo() {
    if (undoStack.length > 0) {
      const lastAction = undoStack[undoStack.length - 1];
      setUndoStack((stack) => stack.slice(0, -1));
      setRedoStack((stack) => [...stack, lastAction]);
      switch (lastAction.type) {
        case 'add':
          setTracks((tracks) => tracks.filter((track) => track.id !== lastAction.track.id));
          setActiveTrackId(null);
          break;
        case 'delete':
          setTracks((tracks) => [...tracks, lastAction.track]);
          setActiveTrackId(lastAction.track.id);
          break;
        case 'edit':
          setTracks((tracks) => tracks.map((track) => {
            if (track.id === lastAction.trackId) {
              return lastAction.oldTrack;
            } else if (track.id === lastAction.newTrack.id) {
              return lastAction.newTrack;
            } else {
              return track;
            }
          }));
          setActiveTrackId(lastAction.trackId);
          break;
        default:
          break;
      }
    }
  }

  function redo() {
    if (redoStack.length > 0) {
      const lastAction = redoStack[redoStack.length - 1];
      setRedoStack((stack) => stack.slice(0, -1));
      setUndoStack((stack) => [...stack, lastAction]);
      switch (lastAction.type) {
        case 'add':
          setTracks((tracks) => [...tracks, lastAction.track]);
          setActiveTrackId(lastAction.track.id);
          break;
        case 'delete':
          setTracks((tracks) => tracks.filter((track) => track.id !== lastAction.track.id));
          setActiveTrackId(null);
          break;
        case 'edit':
          setTracks((tracks) => tracks.map((track) => {
            if (track.id === lastAction.trackId) {
              return lastAction.newTrack;
            } else if (track.id === lastAction.oldTrack.id) {
              return lastAction.oldTrack;
            } else {
              return track;
            }
          }));
          setActiveTrackId(lastAction.newTrack.id);
          break;
        default:
          break;
      }
    }
  }

  function deleteActiveTrack() {
    if (activeTrackId) {
      const trackToDelete = tracks.find((track) => track.id === activeTrackId);
      if (trackToDelete) {
        setTracks((tracks) => tracks.filter((track) => track.id !== activeTrackId));
        setUndoStack((stack) => [...stack, { type: 'delete', track: trackToDelete }]);
        setRedoStack([]);
        setActiveTrackId(null);
        setDeviceIds((deviceIds) => {
          const newDeviceIds = { ...deviceIds };
          delete newDeviceIds[activeTrackId];
          return newDeviceIds;
        });
      }
    }
  }

  function handleTrackClick(trackId) {
    setActiveTrackId(trackId);
    setIsPlaying(false);
    setPlaybackPosition(0);
  }

  function handleNewTrackClick() {
    const newTrack = {
      id: uuidv4(),
      name: `Track ${tracks.length + 1}`,
      duration: '0:00',
      audioChunks: [],
    };
    setTracks((tracks) => [...tracks, newTrack]);
    setActiveTrackId(newTrack.id);
    setUndoStack((stack) => [...stack, { type: 'add', track: newTrack }]);
    setRedoStack([]);
  }

  function handleDeviceChange(trackId, deviceId) {
    setDeviceIds((deviceIds) => {
      const newDeviceIds = { ...deviceIds };
      newDeviceIds[trackId] = deviceId;
      return newDeviceIds;
    });
  }

  function formatDuration(duration) {
    const minutes = Math.floor(duration / 60000);
    const seconds = ((duration % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  return (
    <div className="App">
      <div className="tracks-container">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`track-row ${track.id === activeTrackId ? 'active' : ''}`}
            onClick={() => handleTrackClick(track.id)}
          >
            <div className="track-name">{track.name}</div>
            <div className="track-duration">{track.duration}</div>
            <div className="track-actions">
              <button className="play-button" onClick={startPlayback}>
                <FontAwesomeIcon icon={faPlay} />
              </button>
              <button className="pause-button" onClick={pausePlayback}>
                <FontAwesomeIcon icon={faPause} />
              </button>
              <button className="stop-button" onClick={stopPlayback}>
                <FontAwesomeIcon icon={faStop} />
              </button>
              <button className="delete-button" onClick={deleteActiveTrack}>
                <FontAwesomeIcon icon={faTrash} />
              </button>
              <button
                className={`record-button ${isRecording && activeTrackId === track.id ? 'recording' : ''}`}
                onClick={() => toggleRecording(track.id)}
              >
                <FontAwesomeIcon icon={faRecordVinyl} />
              </button>
              {(
                <DeviceSelector
                trackId={track.id}
                devices={devices}
                deviceIds={deviceIds}
                onChange={handleDeviceChange}
                />
              )}

            </div>
          </div>
        ))}
      </div>
      <button className="new-track-button" onClick={handleNewTrackClick}>
        <FontAwesomeIcon icon={faPlus} />
      </button>
      <button className="undo-button" onClick={undo}>
        <FontAwesomeIcon icon={faUndo} />
      </button>
      <button className="redo-button" onClick={redo}>
        <FontAwesomeIcon icon={faRedo} />
      </button>
    </div>
  );
}

function DeviceSelector({ trackId, devices, deviceIds, onChange }) {
  function handleChange(event) {
    console.log('onChange()');
    onChange(trackId, event.target.value);
  }

  if (!window.stream) {
    console.log('stream not found');
    return null;
  }

  console.log('stream found!');
  return (
    <select
      className="device-select"
      value={deviceIds[trackId] || ''}
      onChange={handleChange}
    >
      <option value="">Select device...</option>
      {devices.map((device) => (
        <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
      ))}
    </select>
  );
}

export default App;