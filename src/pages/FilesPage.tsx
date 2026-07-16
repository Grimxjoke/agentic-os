import { useEffect, useRef, useState } from "react";
import {
  Code2, Columns2, Eye, File, FileCode2, FileText, Folder, FolderOpen,
  LockKeyhole, MoreHorizontal, PanelLeftClose, Plus, Save, Search, Sparkles, X,
} from "lucide-react";
import { workspaceFiles } from "../data/mockData";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { WorkspaceFile } from "../types";

type EditorMode = "code" | "visual" | "split";

export function FilesPage() {
  const [files, setFiles] = useLocalStorage<WorkspaceFile[]>("pi-os-files", workspaceFiles);
  const [activeId, setActiveId] = useState(files[0].id);
  const [tabs, setTabs] = useState(files.slice(0, 3).map((file) => file.id));
  const [mode, setMode] = useState<EditorMode>("visual");
  const [savedPulse, setSavedPulse] = useState(false);
  const active = files.find((file) => file.id === activeId) ?? files[0];
  const openFile = (id: string) => { setActiveId(id); setTabs((current) => current.includes(id) ? current : [...current, id]); };
  const closeTab = (id: string) => { const next = tabs.filter((tab) => tab !== id); setTabs(next); if (activeId === id && next.length) setActiveId(next[next.length - 1]); };
  const updateContent = (content: string) => {
    setFiles((current) => current.map((file) => file.id === active.id ? { ...file, content, updated: "modifié à l'instant" } : file));
    setSavedPulse(true);
    window.setTimeout(() => setSavedPulse(false), 1200);
  };

  return (
    <div className="ide-shell v03-ide">
      <aside className="file-sidebar">
        <header><span>EXPLORATEUR</span><div><button aria-label="Nouveau fichier"><Plus size={15} /></button><button aria-label="Options de l’explorateur"><MoreHorizontal size={15} /></button></div></header>
        <div className="workspace-root"><FolderOpen size={15} /><strong>AGENTIC OS</strong><em>LOCAL</em></div>
        <div className="file-tree">
          <div className="tree-folder"><span><FolderOpen size={14} />Strategy</span>{files.filter((file) => file.path.includes("Strategy")).map((file) => <FileRow file={file} active={file.id === activeId} onClick={() => openFile(file.id)} key={file.id} />)}</div>
          <div className="tree-folder"><span><FolderOpen size={14} />Briefs</span>{files.filter((file) => file.path.includes("Briefs")).map((file) => <FileRow file={file} active={file.id === activeId} onClick={() => openFile(file.id)} key={file.id} />)}</div>
          <div className="tree-folder"><span><FolderOpen size={14} />Artifacts</span>{files.filter((file) => file.path.includes("Artifacts")).map((file) => <FileRow file={file} active={file.id === activeId} onClick={() => openFile(file.id)} key={file.id} />)}</div>
          <div className="tree-folder"><span><Folder size={14} />Agents</span>{files.filter((file) => file.path.includes("Agents")).map((file) => <FileRow file={file} active={file.id === activeId} onClick={() => openFile(file.id)} key={file.id} />)}</div>
        </div>
        <div className="file-sidebar-bottom"><button><Search size={14} />Recherche globale</button><button><FileText size={14} />{files.length} fichiers indexés</button></div>
      </aside>

      <section className="editor-shell">
        <div className="editor-tabs"><button className="panel-toggle" aria-label="Masquer l’explorateur"><PanelLeftClose size={15} /></button>{tabs.map((id) => { const file = files.find((item) => item.id === id); if (!file) return null; return <button className={id === activeId ? "active" : ""} key={id} onClick={() => setActiveId(id)}>{file.type === "html" ? <FileCode2 size={14} /> : <FileText size={14} />}{file.name}<X size={13} onClick={(event) => { event.stopPropagation(); closeTab(id); }} /></button>; })}<span /></div>
        <div className="editor-toolbar">
          <div className="file-breadcrumb">Agentic OS <i>/</i> {active.path.split("/").filter(Boolean).slice(-2).join(" / ")}</div>
          <div className="editor-actions">
            {active.type === "html" && mode !== "code" && <span className="readonly-badge"><LockKeyhole size={12} />Visual read-only</span>}
            <div className="view-toggle editor-mode-toggle">
              <button className={mode === "code" ? "active" : ""} onClick={() => setMode("code")}><Code2 size={13} />Code</button>
              <button className={mode === "visual" ? "active" : ""} onClick={() => setMode("visual")}><Eye size={13} />Visual</button>
              <button className={mode === "split" ? "active" : ""} onClick={() => setMode("split")}><Columns2 size={13} />Split</button>
            </div>
            <button className="icon-button" aria-label="Enregistrer le fichier"><Save size={15} /></button><button className="icon-button" aria-label="Options du fichier"><MoreHorizontal size={15} /></button>
          </div>
        </div>

        <div className={"editor-content mode-" + mode}>
          {mode === "code" && <CodeEditor content={active.content} onChange={updateContent} />}
          {mode === "visual" && <VisualDocument key={active.id + "-visual"} file={active} onChange={updateContent} />}
          {mode === "split" && <><div className="split-pane"><CodeEditor content={active.content} onChange={updateContent} /></div><div className="split-pane visual-pane"><VisualDocument key={active.id + "-split"} file={active} onChange={updateContent} /></div></>}
        </div>

        <footer className="editor-status"><span className={savedPulse ? "saved" : ""}><i />{savedPulse ? "saved locally" : "local autosave"}</span><span>UTF-8</span><span>{active.type === "html" ? "HTML" : "Markdown"}</span><span>Ln {active.content.split("\n").length}</span><strong>{active.type === "html" && mode !== "code" ? <><LockKeyhole size={11} /> Aperçu protégé</> : <><Sparkles size={11} /> Éditeur Visual stable</>}</strong></footer>
      </section>
    </div>
  );
}

function CodeEditor({ content, onChange }: { content: string; onChange: (value: string) => void }) {
  return <div className="code-editor"><div className="line-numbers">{content.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea value={content} onChange={(event) => onChange(event.target.value)} spellCheck={false} /></div>;
}

function VisualDocument({ file, onChange }: { file: WorkspaceFile; onChange: (value: string) => void }) {
  if (file.type === "html") {
    return <div className="notion-canvas html-preview-canvas"><div className="visual-edit-hint readonly"><LockKeyhole size={13} />Aperçu HTML sécurisé en lecture seule · utilisez Code pour modifier</div><div className="html-preview-frame"><iframe title={"Aperçu de " + file.name} srcDoc={file.content} sandbox="" /></div></div>;
  }
  return <MarkdownVisualEditor file={file} onChange={onChange} />;
}

function MarkdownVisualEditor({ file, onChange }: { file: WorkspaceFile; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLElement>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = renderMarkdown(file.content);
    setDirty(false);
  }, [file.id]);

  const save = () => {
    if (!editorRef.current || !dirty) return;
    onChange(markdownFromEditor(editorRef.current));
    setDirty(false);
  };

  return <div className="notion-canvas"><div className={"visual-edit-hint " + (dirty ? "dirty" : "")}><Sparkles size={13} />{dirty ? "Modifications en cours · cliquez hors du document pour enregistrer" : "Édition Markdown directe · Entrée, Retour arrière et Suppr fonctionnent normalement"}</div><article ref={editorRef} className="markdown-preview notion-editor stable-editor" contentEditable suppressContentEditableWarning onInput={() => setDirty(true)} onBlur={save} /></div>;
}

function FileRow({ file, active, onClick }: { file: WorkspaceFile; active: boolean; onClick: () => void }) {
  return <button className={"tree-file " + (active ? "active" : "")} onClick={onClick}>{file.type === "html" ? <FileCode2 size={14} /> : <File size={14} />}<span>{file.name}</span>{file.type === "html" && <LockKeyhole size={10} />}</button>;
}

function renderMarkdown(source: string) {
  const lines = source.split("\n");
  const html: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { html.push("</ul>"); inList = false; } };
  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push("<li>" + inlineMarkdown(line.slice(2)) + "</li>");
      continue;
    }
    closeList();
    if (line.startsWith("# ")) html.push("<h1>" + inlineMarkdown(line.slice(2)) + "</h1>");
    else if (line.startsWith("## ")) html.push("<h2>" + inlineMarkdown(line.slice(3)) + "</h2>");
    else if (line.startsWith("### ")) html.push("<h3>" + inlineMarkdown(line.slice(4)) + "</h3>");
    else if (line.startsWith("> ")) html.push("<blockquote>" + inlineMarkdown(line.slice(2)) + "</blockquote>");
    else if (!line.trim()) html.push("<p><br></p>");
    else html.push("<p>" + inlineMarkdown(line) + "</p>");
  }
  closeList();
  return html.join("");
}

function inlineMarkdown(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function markdownFromEditor(root: HTMLElement) {
  const lines: string[] = [];
  const walk = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    const text = (element as HTMLElement).innerText.replace(/\n+$/g, "");
    if (tag === "h1") lines.push("# " + text);
    else if (tag === "h2") lines.push("## " + text);
    else if (tag === "h3") lines.push("### " + text);
    else if (tag === "blockquote") lines.push("> " + text);
    else if (tag === "li") lines.push("- " + text);
    else if (tag === "ul" || tag === "ol") Array.from(element.children).forEach(walk);
    else if (tag === "div" && element.children.length) Array.from(element.children).forEach(walk);
    else lines.push(text);
  };
  Array.from(root.children).forEach(walk);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}
