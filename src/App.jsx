import { useState, useRef, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, getDoc, onSnapshot, deleteDoc, getDocs
} from "firebase/firestore";

// ─── Default vragen ────────────────────────────────────────────────────────────
const DEFAULT_QUESTIONS = [
  "Maak een foto met een standbeeld",
  "Groepsfoto bij een fontein",
  "Foto van iets geel",
  "Creatief gebruik van perspectief",
  "Teamfoto in een menselijke piramide",
];

// ─── Utility: compress image to base64 ────────────────────────────────────────
function compressImage(file, maxW = 800) {
  return new Promise((res) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        res(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── ICONS ─────────────────────────────────────────────────────────────────────
const IconCamera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const IconGrid = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const IconDownload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function FotoSpel() {
  const [mode, setMode] = useState("landing");
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [submissions, setSubmissions] = useState({});
  const [loaded, setLoaded] = useState(false);

  // Load questions from Firestore + live listener for submissions
  useEffect(() => {
    // Load questions
    (async () => {
      const qDoc = await getDoc(doc(db, "config", "questions"));
      if (qDoc.exists()) setQuestions(qDoc.data().list);
      setLoaded(true);
    })();

    // Live listener for submissions
    const unsub = onSnapshot(collection(db, "submissions"), (snap) => {
      const data = {};
      snap.forEach(d => { data[d.id] = d.data().photos || []; });
      setSubmissions(data);
    });
    return () => unsub();
  }, []);

  const persistQuestions = async (q) => {
    setQuestions(q);
    await setDoc(doc(db, "config", "questions"), { list: q });
  };

  const persistSubmissions = async (newSubs) => {
    // newSubs is the full map; diff and write only changed keys
    for (const key of Object.keys(newSubs)) {
      await setDoc(doc(db, "submissions", key), { photos: newSubs[key] });
    }
    // Delete removed keys
    for (const key of Object.keys(submissions)) {
      if (!newSubs[key]) await deleteDoc(doc(db, "submissions", key));
    }
  };

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f0f1a", color: "#fff", fontFamily: "serif", fontSize: "1.4rem" }}>
      Laden…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f1a", color: "#f0ede6", fontFamily: "'Georgia', serif" }}>
      {mode === "landing" && <LandingScreen setMode={setMode} />}
      {mode === "deelnemer" && (
        <DeelnemerView
          questions={questions}
          submissions={submissions}
          onSubmit={persistSubmissions}
          onBack={() => setMode("landing")}
        />
      )}
      {mode === "leiding" && (
        <LeidingView
          questions={questions}
          submissions={submissions}
          onClear={persistSubmissions}
          onUpdateQuestions={persistQuestions}
          onBack={() => setMode("landing")}
        />
      )}
    </div>
  );
}

// ─── LANDING ───────────────────────────────────────────────────────────────────
function LandingScreen({ setMode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center", background: "radial-gradient(ellipse at 50% 30%, #1e1640 0%, #0f0f1a 70%)" }}>
      <div style={{ fontSize: "4rem", marginBottom: "0.5rem" }}>📸</div>
      <h1 style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", fontWeight: "normal", letterSpacing: "0.05em", margin: "0 0 0.3rem", color: "#f0ede6" }}>FotoSpel</h1>
      <p style={{ color: "#9b93b3", fontSize: "1.1rem", marginBottom: "3rem", maxWidth: 400 }}>
        Maak foto's, lever ze in per vraag en groepje — de leiding beheert alles overzichtelijk.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: 340 }}>
        <button onClick={() => setMode("deelnemer")} style={btnStyle("#e8c14a", "#0f0f1a")}>
          <IconCamera /> &nbsp; Ik ben deelnemer
        </button>
        <button onClick={() => setMode("leiding")} style={btnStyle("#8b7fd4", "#fff")}>
          <IconGrid /> &nbsp; Ik ben leiding
        </button>
      </div>
      <p style={{ marginTop: "2.5rem", fontSize: "0.75rem", color: "#4a4460", maxWidth: 320 }}>
        Foto's worden live gedeeld via Firebase zodat de leiding ze direct kan bekijken.
      </p>
    </div>
  );
}

// ─── DEELNEMER VIEW ────────────────────────────────────────────────────────────
function DeelnemerView({ questions, submissions, onSubmit, onBack }) {
  const [groep, setGroep] = useState("");
  const [groepIngevoerd, setGroepIngevoerd] = useState(false);
  const [activeQ, setActiveQ] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileRef = useRef();

  const key = (qi) => `${groep}__${qi}`;
  const myPhotos = (qi) => submissions[key(qi)] || [];

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const img = await compressImage(file);
    const k = key(activeQ);
    const existing = submissions[k] || [];
    const updated = [...existing, { img, timestamp: new Date().toISOString(), groep }];
    await onSubmit({ ...submissions, [k]: updated });
    setUploading(false);
    setJustUploaded(true);
    setTimeout(() => setJustUploaded(false), 2000);
    e.target.value = "";
  };

  if (!groepIngevoerd) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", background: "radial-gradient(ellipse at 50% 30%, #1e1640 0%, #0f0f1a 70%)" }}>
        <button onClick={onBack} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#9b93b3", cursor: "pointer", marginBottom: "2rem", fontSize: "0.9rem" }}>← Terug</button>
        <h2 style={{ fontSize: "1.8rem", fontWeight: "normal", marginBottom: "0.5rem" }}>Wie zijn jullie?</h2>
        <p style={{ color: "#9b93b3", marginBottom: "2rem" }}>Voer de naam van jullie groepje in</p>
        <input
          value={groep}
          onChange={e => setGroep(e.target.value)}
          placeholder="bv. Groep Rood, Team A…"
          style={inputStyle}
          onKeyDown={e => e.key === "Enter" && groep.trim() && setGroepIngevoerd(true)}
          autoFocus
        />
        <button onClick={() => setGroepIngevoerd(true)} disabled={!groep.trim()} style={{ ...btnStyle("#e8c14a", "#0f0f1a"), marginTop: "1rem", width: "100%", maxWidth: 340, opacity: groep.trim() ? 1 : 0.4 }}>
          Doorgaan →
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid #2a2545", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#9b93b3", cursor: "pointer", fontSize: "0.9rem" }}>← Terug</button>
        <span style={{ color: "#e8c14a", fontWeight: "bold", fontSize: "1.05rem" }}>📸 {groep}</span>
        <span style={{ color: "#4a4460", fontSize: "0.8rem" }}>{questions.length} vragen</span>
      </div>

      <div style={{ display: "flex", overflowX: "auto", padding: "0.8rem 1rem", gap: "0.5rem", borderBottom: "1px solid #2a2545" }}>
        {questions.map((_, i) => {
          const count = myPhotos(i).length;
          const active = activeQ === i;
          return (
            <button key={i} onClick={() => setActiveQ(i)} style={{
              flexShrink: 0, padding: "0.4rem 0.9rem", borderRadius: "999px", border: "1.5px solid",
              borderColor: active ? "#e8c14a" : count > 0 ? "#4a4460" : "#2a2545",
              background: active ? "#e8c14a" : "transparent",
              color: active ? "#0f0f1a" : count > 0 ? "#9b93b3" : "#4a4460",
              cursor: "pointer", fontSize: "0.85rem", fontWeight: active ? "bold" : "normal",
              display: "flex", alignItems: "center", gap: "0.3rem"
            }}>
              V{i + 1} {count > 0 && <span style={{ background: active ? "#0f0f1a22" : "#e8c14a33", borderRadius: "999px", padding: "0 5px", fontSize: "0.75rem" }}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, padding: "1.5rem" }}>
        <div style={{ background: "#1a1630", border: "1px solid #2a2545", borderRadius: "1rem", padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ color: "#9b93b3", fontSize: "0.8rem", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Vraag {activeQ + 1}</div>
          <div style={{ fontSize: "1.2rem", lineHeight: 1.4 }}>{questions[activeQ]}</div>
        </div>

        <input type="file" accept="image/*" capture="environment" ref={fileRef} style={{ display: "none" }} onChange={handleFile} />
        <button onClick={() => fileRef.current.click()} disabled={uploading} style={{ ...btnStyle(justUploaded ? "#4caf7d" : "#e8c14a", "#0f0f1a"), width: "100%", marginBottom: "1.5rem", fontSize: "1rem", padding: "0.9rem" }}>
          {uploading ? "Uploaden…" : justUploaded ? <><IconCheck /> &nbsp; Foto opgeslagen!</> : <><IconCamera /> &nbsp; Foto toevoegen</>}
        </button>

        {myPhotos(activeQ).length > 0 && (
          <div>
            <p style={{ color: "#9b93b3", fontSize: "0.85rem", marginBottom: "0.8rem" }}>{myPhotos(activeQ).length} foto{myPhotos(activeQ).length > 1 ? "s" : ""} ingediend</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {myPhotos(activeQ).map((s, i) => (
                <div key={i} style={{ aspectRatio: "1", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid #2a2545" }}>
                  <img src={s.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #2a2545" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#9b93b3", marginBottom: "0.4rem" }}>
          <span>Voortgang</span>
          <span>{questions.filter((_, i) => myPhotos(i).length > 0).length}/{questions.length} vragen beantwoord</span>
        </div>
        <div style={{ height: 4, background: "#2a2545", borderRadius: 999 }}>
          <div style={{ height: "100%", background: "#e8c14a", borderRadius: 999, width: `${(questions.filter((_, i) => myPhotos(i).length > 0).length / questions.length) * 100}%`, transition: "width 0.4s" }} />
        </div>
      </div>
    </div>
  );
}

// ─── LEIDING VIEW ─────────────────────────────────────────────────────────────
function LeidingView({ questions, submissions, onClear, onUpdateQuestions, onBack }) {
  const [tab, setTab] = useState("overzicht");
  const [presentatieQ, setPresentatieQ] = useState(0);
  const [presentatieI, setPresentatieI] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editQuestions, setEditQuestions] = useState(questions);

  const allGroups = [...new Set(
    Object.values(submissions).flatMap(arr => arr.map(s => s.groep)).filter(Boolean)
  )].sort();

  const photosForQ = (qi) => {
    return allGroups.flatMap(g => {
      const k = `${g}__${qi}`;
      return (submissions[k] || []).map(s => ({ ...s, groep: g, key: k }));
    });
  };

  const presentatiePhotos = photosForQ(presentatieQ);
  const totalPhotos = Object.values(submissions).reduce((s, arr) => s + arr.length, 0);

  const deletePhoto = async (key, idx) => {
    const newSubs = { ...submissions };
    newSubs[key] = (newSubs[key] || []).filter((_, i) => i !== idx);
    if (newSubs[key].length === 0) delete newSubs[key];
    await onClear(newSubs);
  };

  const clearAll = async () => {
    if (window.confirm("Weet je zeker dat je ALLE inzendingen wil verwijderen?")) {
      await onClear({});
    }
  };

  const saveQuestions = async () => {
    await onUpdateQuestions(editQuestions.filter(q => q.trim()));
    setEditMode(false);
  };

  const downloadImage = (img, name) => {
    const a = document.createElement("a");
    a.href = img;
    a.download = name;
    a.click();
  };

  const statBadge = {
    background: "#1a1630", border: "1px solid #2a2545", borderRadius: "999px",
    padding: "0.2rem 0.7rem", display: "inline-block",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid #2a2545", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#9b93b3", cursor: "pointer", fontSize: "0.9rem" }}>← Terug</button>
          <span style={{ color: "#8b7fd4", fontWeight: "bold", fontSize: "1.1rem" }}>🎬 Leiding</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem", color: "#9b93b3" }}>
          <span style={statBadge}>{allGroups.length} groepjes</span>
          <span style={statBadge}>{totalPhotos} foto's</span>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #2a2545" }}>
        {["overzicht", "vragen", "presentatie"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "0.8rem", background: "none", border: "none",
            borderBottom: tab === t ? "2px solid #8b7fd4" : "2px solid transparent",
            color: tab === t ? "#8b7fd4" : "#4a4460", cursor: "pointer", fontSize: "0.9rem",
            textTransform: "capitalize", transition: "all 0.2s"
          }}>
            {t === "overzicht" ? "📋 Overzicht" : t === "vragen" ? "❓ Vragen" : "🖼️ Presentatie"}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>

        {tab === "overzicht" && (
          <div>
            {questions.map((q, qi) => {
              const photos = photosForQ(qi);
              return (
                <div key={qi} style={{ marginBottom: "2rem" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.8rem", marginBottom: "0.8rem" }}>
                    <span style={{ color: "#8b7fd4", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>V{qi + 1}</span>
                    <span style={{ fontSize: "1rem" }}>{q}</span>
                    <span style={{ marginLeft: "auto", color: "#4a4460", fontSize: "0.8rem" }}>{photos.length} foto{photos.length !== 1 ? "'s" : ""}</span>
                  </div>
                  {photos.length === 0 ? (
                    <div style={{ color: "#4a4460", fontSize: "0.85rem", padding: "0.8rem", border: "1px dashed #2a2545", borderRadius: "0.5rem", textAlign: "center" }}>Nog geen foto's</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.6rem" }}>
                      {photos.map((s, i) => {
                        const localIdx = (submissions[s.key] || []).findIndex(x => x.img === s.img);
                        return (
                          <div key={i} style={{ position: "relative", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid #2a2545", aspectRatio: "1" }}>
                            <img src={s.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, #000a)", padding: "0.3rem 0.4rem", fontSize: "0.7rem", color: "#fff" }}>{s.groep}</div>
                            <div style={{ position: "absolute", top: "4px", right: "4px", display: "flex", gap: "3px" }}>
                              <button onClick={() => downloadImage(s.img, `V${qi + 1}_${s.groep}_${i + 1}.jpg`)} style={iconBtn("#e8c14a")} title="Download"><IconDownload /></button>
                              <button onClick={() => deletePhoto(s.key, localIdx)} style={iconBtn("#e05a5a")} title="Verwijder"><IconTrash /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {totalPhotos > 0 && (
              <button onClick={clearAll} style={{ ...btnStyle("#e05a5a", "#fff"), marginTop: "1rem" }}>
                <IconTrash /> &nbsp; Alles verwijderen
              </button>
            )}
          </div>
        )}

        {tab === "vragen" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontWeight: "normal", fontSize: "1.1rem" }}>Vragen beheren</h3>
              {!editMode ? (
                <button onClick={() => { setEditQuestions([...questions]); setEditMode(true); }} style={{ ...btnStyle("#8b7fd4", "#fff"), padding: "0.4rem 1rem", fontSize: "0.85rem" }}>
                  <IconSettings /> &nbsp; Bewerken
                </button>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => setEditMode(false)} style={{ ...btnStyle("#2a2545", "#9b93b3"), padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}>Annuleer</button>
                  <button onClick={saveQuestions} style={{ ...btnStyle("#4caf7d", "#fff"), padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}>
                    <IconCheck /> &nbsp; Opslaan
                  </button>
                </div>
              )}
            </div>
            {editMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                {editQuestions.map((q, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ color: "#8b7fd4", fontSize: "0.85rem", width: "1.8rem", flexShrink: 0, textAlign: "right" }}>V{i + 1}</span>
                    <input value={q} onChange={e => { const nq = [...editQuestions]; nq[i] = e.target.value; setEditQuestions(nq); }} style={{ ...inputStyle, flex: 1, margin: 0 }} />
                    <button onClick={() => setEditQuestions(editQuestions.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#e05a5a", cursor: "pointer", flexShrink: 0 }}><IconTrash /></button>
                  </div>
                ))}
                <button onClick={() => setEditQuestions([...editQuestions, ""])} style={{ ...btnStyle("#2a2545", "#9b93b3"), marginTop: "0.5rem", border: "1px dashed #4a4460" }}>
                  + Vraag toevoegen
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                {questions.map((q, i) => (
                  <div key={i} style={{ background: "#1a1630", border: "1px solid #2a2545", borderRadius: "0.7rem", padding: "1rem 1.2rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                    <span style={{ color: "#8b7fd4", fontSize: "0.85rem", flexShrink: 0, paddingTop: "2px" }}>V{i + 1}</span>
                    <span>{q}</span>
                    <span style={{ marginLeft: "auto", color: "#4a4460", fontSize: "0.8rem", flexShrink: 0 }}>{photosForQ(i).length} foto's</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "presentatie" && (
          <div>
            <p style={{ color: "#9b93b3", fontSize: "0.85rem", marginBottom: "1.2rem" }}>
              Gebruik dit als presentatiemodus. Kies een vraag en blader door de ingezonden foto's.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
              {questions.map((_, qi) => {
                const cnt = photosForQ(qi).length;
                return (
                  <button key={qi} onClick={() => { setPresentatieQ(qi); setPresentatieI(0); }} style={{
                    padding: "0.4rem 0.9rem", borderRadius: "999px", border: "1.5px solid",
                    borderColor: presentatieQ === qi ? "#8b7fd4" : "#2a2545",
                    background: presentatieQ === qi ? "#8b7fd4" : "transparent",
                    color: presentatieQ === qi ? "#fff" : "#9b93b3",
                    cursor: "pointer", fontSize: "0.85rem"
                  }}>
                    V{qi + 1} <span style={{ opacity: 0.7 }}>({cnt})</span>
                  </button>
                );
              })}
            </div>

            <div style={{ background: "#1a1630", border: "1px solid #2a2545", borderRadius: "1rem", padding: "1rem 1.5rem", marginBottom: "1.5rem" }}>
              <div style={{ color: "#8b7fd4", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>Vraag {presentatieQ + 1}</div>
              <div style={{ fontSize: "1.1rem" }}>{questions[presentatieQ]}</div>
            </div>

            {presentatiePhotos.length === 0 ? (
              <div style={{ textAlign: "center", color: "#4a4460", padding: "3rem", border: "1px dashed #2a2545", borderRadius: "1rem" }}>
                Nog geen foto's voor deze vraag
              </div>
            ) : (
              <>
                <div style={{ position: "relative", borderRadius: "1rem", overflow: "hidden", aspectRatio: "4/3", marginBottom: "1rem", border: "1px solid #2a2545", background: "#0f0f1a" }}>
                  <img src={presentatiePhotos[presentatieI].img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "1rem 1.5rem", background: "linear-gradient(transparent, #000d)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#e8c14a", fontWeight: "bold" }}>{presentatiePhotos[presentatieI].groep}</span>
                    <span style={{ color: "#9b93b3", fontSize: "0.85rem" }}>{presentatieI + 1} / {presentatiePhotos.length}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.8rem", marginBottom: "1rem" }}>
                  <button onClick={() => setPresentatieI(Math.max(0, presentatieI - 1))} disabled={presentatieI === 0} style={{ ...btnStyle("#2a2545", "#9b93b3"), flex: 1, opacity: presentatieI === 0 ? 0.4 : 1 }}>← Vorige</button>
                  <button onClick={() => setPresentatieI(Math.min(presentatiePhotos.length - 1, presentatieI + 1))} disabled={presentatieI === presentatiePhotos.length - 1} style={{ ...btnStyle("#8b7fd4", "#fff"), flex: 1, opacity: presentatieI === presentatiePhotos.length - 1 ? 0.4 : 1 }}>Volgende →</button>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
                  {presentatiePhotos.map((p, i) => (
                    <div key={i} onClick={() => setPresentatieI(i)} style={{ flexShrink: 0, width: 60, height: 60, borderRadius: "0.4rem", overflow: "hidden", border: `2px solid ${i === presentatieI ? "#8b7fd4" : "#2a2545"}`, cursor: "pointer", opacity: i === presentatieI ? 1 : 0.6 }}>
                      <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
function btnStyle(bg, color) {
  return {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: "0.4rem", padding: "0.7rem 1.4rem", background: bg, color,
    border: "none", borderRadius: "0.6rem", cursor: "pointer",
    fontSize: "0.95rem", fontFamily: "inherit", transition: "opacity 0.2s",
  };
}
const inputStyle = {
  width: "100%", maxWidth: 340, padding: "0.8rem 1rem", background: "#1a1630",
  border: "1px solid #2a2545", borderRadius: "0.6rem", color: "#f0ede6",
  fontSize: "1rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
function iconBtn(color) {
  return {
    width: 24, height: 24, borderRadius: "4px", background: "#000a",
    border: "none", cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", color, padding: 0,
  };
}
