import { useState, useRef } from "react";
import "./App.css";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [tracks, setTracks] = useState([
    { id: 1, name: "Track 1", audioChunks: [] },
    { id: 2, name: "Track 2", audioChunks: [] },
  ]);
  const mediaRecorderRef = useRef(null);

  async function toggleRecording(trackId) {
    if (!navigator.mediaDevices) {
      alert("Your browser doesn't support audio recording.");
      return;
    }

    const trackIndex = tracks.findIndex((track) => track.id === trackId);
    const track = tracks[trackIndex];

    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = (event) => {
          track.audioChunks.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          setTracks((prevTracks) => {
            const updatedTracks = [...prevTracks];
            updatedTracks[trackIndex] = { ...track };
            return updatedTracks;
          });
        };

        mediaRecorderRef.current.start();

        setIsRecording(true);
      } catch (error) {
        console.error("Error accessing the microphone:", error);
      }
    } else if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  function playTrack(trackId) {
    const trackIndex = tracks.findIndex((track) => track.id === trackId);
    const track = tracks[trackIndex];
    const audioBlob = new Blob(track.audioChunks, { type: "audio/wav" });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
  }

  function deleteTrack(trackId) {
    setTracks((prevTracks) =>
      prevTracks.filter((track) => track.id !== trackId)
    );
  }

  return (
    <div className="daw">
      <header className="daw-header">
        <button className="btn">Play</button>
        <button className="btn">Stop</button>
        {tracks.map((track) => (
          <button
            key={track.id}
            className="btn"
            onClick={() => toggleRecording(track.id)}
          >
            {isRecording && track.id === tracks[0].id ? "Stop" : "Record"}
          </button>
        ))}
      </header>
      <main className="daw-tracks">
        {tracks.map((track) => (
          <div key={track.id} className="track">
            <label>{track.name}</label>
            <div className="track-bar">
              {track.audioChunks.length > 0 ? (
                <button className="btn" onClick={() => playTrack(track.id)}>
                  Play
                </button>
              ) : null}
              <button className="btn" onClick={() => deleteTrack(track.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
