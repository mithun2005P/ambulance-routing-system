import { useEffect, useRef, useState } from "react";
import api from "../api";

export default function SearchBar({ onSelect, placeholder = "Search hospitals, stations, junctions…" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.search(query).then((r) => {
        setResults(r);
        setOpen(true);
      });
    }, 150);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="search-wrap" ref={wrapRef}>
      <input
        className="search-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="search-dropdown">
          {results.map((r) => (
            <div
              key={r.id}
              className="search-dropdown__item"
              onClick={() => {
                onSelect(r);
                setQuery(r.name);
                setOpen(false);
              }}
            >
              <span>{r.name}</span>
              <span className="badge">{r.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
