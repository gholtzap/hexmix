"use client";
import { useState, useId } from 'react';
import { useLinkState } from "@/hooks/useLinkState";
import { Action } from './primitives';
import type { Project } from './data';
import { projectRepository } from './data';
import { isDomainName, projectNameError } from '@/lib/validation';
import type { PageAction } from './pages/registry';

type Props = { title: string; detail?: string; project: Project; existing: string[]; onUpdate: (values: Partial<Project>) => void; onAction: PageAction; onClose: () => void };
export default function ProjectActions({ title, detail, project, existing, onUpdate, onAction, onClose }: Props) {
  const [name, setName] = useLinkState("ProjectActions.ProjectActions.name", project.name, { private: true, scope: `project:${project.name}` }), [domain, setDomain] = useLinkState("ProjectActions.ProjectActions.domain", project.domain, { private: true, scope: `project:${project.name}` });
  const [repository, setRepository] = useLinkState("ProjectActions.ProjectActions.repository", projectRepository(project), { private: true, scope: `project:${project.name}` }), [team, setTeam] = useLinkState("ProjectActions.ProjectActions.team", 'Personal', { scope: `project:${project.name}` });
  const [error, setError] = useLinkState("ProjectActions.ProjectActions.error", '', { scope: `project:${project.name}` }), [notice, setNotice] = useState(''), [file, setFile] = useLinkState("ProjectActions.ProjectActions.file", 'app/page.tsx', { scope: `project:${project.name}` });
  const [checks, setChecks] = useLinkState("ProjectActions.ProjectActions.checks", [project.production, project.connected, project.score > 0], { scope: `project:${project.name}` });
  const feedbackId = useId();
  const [feedback, setFeedback] = useLinkState('ProjectActions.feedback', '', { private:true, scope:`project:${project.name}` });
  const [section, setSection] = useLinkState("ProjectActions.ProjectActions.section", 'Overview', { scope: `project:${project.name}` });
  if (title === 'Preview' || title === 'Visit with Toolbar') return <section className="vc-live-preview" aria-label="Project preview"><nav>{['Overview', 'Features', 'Contact'].map(label => <Action key={label} aria-pressed={section === label} onClick={() => setSection(label)}>{label}</Action>)}</nav><h2>{project.name}</h2><p>{section === 'Overview' ? project.commit : section === 'Features' ? 'Explore the latest release, review changes, and share feedback with the team.' : 'Send feedback to the project team.'}</p>{section === 'Contact' ? <form onSubmit={event => { event.preventDefault(); setNotice('Feedback saved in this session.'); }}><label htmlFor={feedbackId}>Feedback</label><textarea id={feedbackId} required maxLength={2000} value={feedback} onChange={event=>setFeedback(event.target.value)} /><Action type="submit" className="primary">Save feedback</Action></form> : <Action className="primary" onClick={() => setSection('Contact')}>Contact the team</Action>}{notice && <p role="status">{notice}</p>}<div className="vc-dialog-actions"><Action className="outline" onClick={() => onAction('View Logs', project.name)}>View logs</Action><Action className="outline" onClick={() => onAction('Git repository', project.name)}>View source</Action></div></section>;
  if (['View source', 'Git repository'].includes(title)) return <><p>{repository}</p><div className="vc-source-files">{['app/page.tsx', 'package.json', 'README.md'].map(value => <Action key={value} aria-pressed={file === value} onClick={() => setFile(value)}>{value}</Action>)}</div><code><textarea className="vc-source-code" aria-label="File contents" readOnly rows={10} value={file === 'package.json' ? JSON.stringify({ name: project.name, scripts: { dev: 'next dev', build: 'next build' } }, null, 2) : file === 'README.md' ? `# ${project.name}\n\n${project.commit}\n\nProduction domain: ${project.domain}` : `export default function Page() {\n  return <main><h1>${project.name}</h1></main>;\n}`} /></code><div className="vc-dialog-actions"><Action className="outline" onClick={() => onAction('Deployments', project.name)}>View deployments</Action><Action className="primary" onClick={() => onAction('Preview', project.name)}>Open preview</Action></div></>;
  if (title === 'Production checklist') return <><p>{`Review the production setup for ${project.name}.`}</p>{['Production deployment ready', 'Repository connected', 'Performance reviewed'].map((label, index) => <label className="vc-check-row" key={label}><input type="checkbox" checked={checks[index]} onChange={event => setChecks(old => old.map((value, i) => i === index ? event.target.checked : value))} />{label}</label>)}<p role="status">{`${checks.filter(Boolean).length} of 3 complete`}</p><div className="vc-dialog-actions"><Action className="primary" onClick={() => { onUpdate({ production: checks[0], connected: checks[1], score: checks[2] ? 100 : 0 }); onClose(); }}>Save checklist</Action></div></>;
  return <form noValidate onSubmit={event => {
    event.preventDefault();
    if (title === 'Transfer Project') { onUpdate({ team }); onClose(); return; }
    if (title === 'Connect Git Repository') {
      if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository.trim())) { setError('Enter a repository as owner/name.'); return; }
      onUpdate({ connected: true, commit: `Connected to ${repository.trim()}`, repository: repository.trim() }); onClose(); return;
    }
    const nameError = projectNameError(name, existing);
    if (nameError) { setError(nameError); return; }
    if (!isDomainName(domain)) { setError('Enter a valid domain, such as app.example.com.'); return; }
    onUpdate({ name, domain }); onClose();
  }}>
    {title === 'Transfer Project' ? <><p>{`Move ${project.name} to another workspace.`}</p><label>Destination workspace<select aria-label="Destination workspace" value={team} onChange={event => setTeam(event.target.value)}><option>Personal</option><option>Design studio</option></select></label></> : title === 'Connect Git Repository' ? <label>Repository<input value={repository} onChange={event => setRepository(event.target.value)} placeholder="owner/repository" /></label> : <><label>Project name<input value={name} onChange={event => setName(event.target.value)} maxLength={64} /></label><label>Domain<input value={domain} onChange={event => setDomain(event.target.value)} /></label><p>Runtime: {project.runtime || 'Node.js 22'}</p></>}
    {error && <p role="alert">{error}</p>}<div className="vc-dialog-actions"><Action className="outline" onClick={onClose}>Cancel</Action><Action className="primary" type="submit">{title === 'Transfer Project' ? 'Transfer project' : title === 'Connect Git Repository' ? 'Connect repository' : 'Save changes'}</Action></div>
  </form>;
}
