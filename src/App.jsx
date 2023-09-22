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
    } else if (event.code === 'KeyS') {
      event.preventDefault();
      stopPlayback();
    } else if (event.code === 'KeyZ' && event.ctrlKey) {
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    } else if (event.code === 'Delete') {
      event.preventDefault();
      deleteActiveTrack();
    }
  }

  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function startRecording() {
    setIsRecording(true);
    setAudioChunks([]);
    mediaRecorderRef.current = new MediaRecorder(window.stream);
    mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
    mediaRecorderRef.current.start();
  }

  function stopRecording() {
    setIsRecording(false);
    mediaRecorderRef.current.stop();
    const newTrack = {
      id: uuidv4(),
      name: `Track ${tracks.length + 1}`,
      duration: formatDuration(audioChunks.length * 100),
      audioChunks: audioChunks,
    };
    setTracks((tracks) => [...tracks, newTrack]);
    setActiveTrackId(newTrack.id);
    setUndoStack((stack) => [...stack, { type: 'add', track: newTrack }]);
    setRedoStack([]);
  }

  function handleDataAvailable(event) {
    setAudioChunks((chunks) => [...chunks, event.data]);
  }

  function startPlayback() {
    if (!activeTrackId) {
      setActiveTrackId(tracks[0].id);
    }
    setIsPlaying(true);
    playbackIntervalRef.current = setInterval(() => {
      setPlaybackPosition((position) => position + 100);
    }, 100);
  }

  function pausePlayback() {
    setIsPlaying(false);
    clearInterval(playbackIntervalRef.current);
  }

  function stopPlayback() {
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
              <button className="play-button">
                <FontAwesomeIcon icon={faPlay} />
              </button>
              <button className="pause-button">
                <FontAwesomeIcon icon={faPause} />
              </button>
              <button className="stop-button">
                <FontAwesomeIcon icon={faStop} />
              </button>
              <button className="delete-button" onClick={deleteActiveTrack}>
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        className={`record-button ${isRecording ? 'recording' : ''}`}
        onClick={toggleRecording}
      >
        <FontAwesomeIcon icon={faRecordVinyl} />
      </button>
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

export default App;