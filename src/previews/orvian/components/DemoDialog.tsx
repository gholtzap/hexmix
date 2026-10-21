'use client';

import { useEffect, useRef, useState } from 'react';
import { useLinkState } from "@/hooks/useLinkState";
import { stringRecord } from "@/lib/link-state";
import { createPortal } from 'react-dom';
import { companySizes, validateDemo, type DemoValues } from '../lib/demo-validation';

const emptyValues: DemoValues = { firstName: '', lastName: '', email: '', companySize: '' };
const labelClass = 'block text-sm text-stone-400 mb-2';
const fieldIds = { firstName: 'demo-first-name', lastName: 'demo-last-name', email: 'demo-email' };
const actionClass = 'mt-6 md:mt-8 w-full border text-center pt-4 pb-3.5 px-8 transition-all duration-300 ease-in-out rounded-lg cursor-pointer border-stone-50 text-stone-50 bg-gradient-to-r from-coral/80 via-peach/80 to-amber/80 shadow-lg/20 hover:shadow-xl/50 hover:from-coral hover:via-peach hover:to-amber';

export default function DemoDialog() {
  const [open, setOpen] = useLinkState("DemoDialog.DemoDialog.open", false);
  const [values, setValues] = useLinkState("DemoDialog.DemoDialog.values", emptyValues, { private: true });
  const [errors, setErrors] = useLinkState<ReturnType<typeof validateDemo>>("DemoDialog.DemoDialog.errors", {}, { validate: stringRecord });
  const [complete, setComplete] = useLinkState("DemoDialog.DemoDialog.complete", false);
  const overlay = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const show = () => {
      setValues(emptyValues);
      setErrors({});
      setComplete(false);
      setOpen(true);
    };
    const openFromButton = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-open-demo]')) return;
      event.preventDefault();
      show();
    };
    document.addEventListener('click', openFromButton);
    window.addEventListener('open-demo', show);
    document.addEventListener('open-demo', show);
    return () => {
      document.removeEventListener('click', openFromButton);
      window.removeEventListener('open-demo', show);
      document.removeEventListener('open-demo', show);
    };
  }, []);

  useEffect(() => {
    if (!open || !overlay.current) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el !== overlay.current);
    const previousInert = siblings.map(el => el.inert);
    siblings.forEach(el => { el.inert = true; });
    document.body.style.overflow = 'hidden';
    overlay.current.querySelector<HTMLInputElement>('input')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(overlay.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]') ?? []);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      siblings.forEach((el, index) => { el.inert = previousInert[index]; });
      window.removeEventListener('keydown', keydown);
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => { if (complete) closeButton.current?.focus(); }, [complete]);
  if (!open) return null;
  const tooSmall = values.companySize === '<10';
  const field = (name: 'firstName' | 'lastName' | 'email', label: string, autoComplete: string) => (
    <div className="flex-1">
      <label htmlFor={fieldIds[name]} className={labelClass}>{label}</label>
      <input id={fieldIds[name]} autoComplete={autoComplete} type={name === 'email' ? 'email' : 'text'} placeholder={name === 'email' ? 'hello@orvian.example' : undefined} value={values[name]} onChange={event => setValues({...values, [name]: event.target.value})} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${fieldIds[name]}-error` : undefined} className={`w-full rounded-lg bg-stone-50/5 border px-4 py-3 text-stone-100 placeholder-stone-500 focus:outline-none transition-colors ${errors[name] ? 'border-coral' : 'border-onyx focus:border-peach'}`} />
      {errors[name] && <p id={`${fieldIds[name]}-error`} className="mt-1.5 text-sm text-coral">{errors[name]}</p>}
    </div>
  );
  return createPortal(
    <div ref={overlay} data-orvian-dialog className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="demo-gate-title" onClick={() => setOpen(false)}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-stone-900 border border-onyx rounded-2xl shadow-2xl bg-[url('/noise.png')] bg-[length:120px_120px] bg-repeat" onClick={event => event.stopPropagation()}>
          <button ref={closeButton} type="button" aria-label="Close" aria-describedby="demo-close-tip" onClick={() => setOpen(false)} className="clone-tooltip-trigger absolute top-2 right-2 p-3 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg><span id="demo-close-tip" className="clone-tooltip" role="tooltip">Close</span></button>
          <form noValidate className="p-6 pt-7 md:p-10" onSubmit={event => {
            event.preventDefault();
            const nextErrors = validateDemo(values);
            setErrors(nextErrors);
            if (!Object.keys(nextErrors).length) setComplete(true);
          }}>
            <h2 id="demo-gate-title" className="font-title text-[1.75rem]! md:text-[3.5rem]! text-stone-50 mb-2 pr-10">Book a demo</h2>
            {complete ? <div><p className="text-stone-300 mb-6">Preview complete. No booking was sent.</p><button type="button" className={actionClass} onClick={() => setOpen(false)}>Close</button></div> : <>
              <p className="text-stone-300 mb-6 md:mb-8">Tell us a bit about your company.</p>
              <div className="flex flex-col gap-4 md:gap-5">
                <div className="flex flex-col md:flex-row gap-4 md:gap-5">{field('firstName', 'First name', 'given-name')}{field('lastName', 'Last name', 'family-name')}</div>
                {field('email', 'Company email', 'email')}
                <div>
                  <p id="demo-size-label" className={labelClass}>Company size</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3" role="group" aria-labelledby="demo-size-label">
                    {companySizes.map(size => <button key={size} type="button" aria-pressed={values.companySize === size} aria-describedby={size === '<10' ? 'demo-gate-too-small' : undefined} onClick={() => { setValues({...values, companySize:size}); setErrors({...errors, companySize:undefined}); }} className={`rounded-lg border py-3 px-2 text-sm text-center transition-all ${size === '<10' ? values.companySize === size ? 'cursor-default border-stone-600 text-stone-400 bg-stone-50/5' : 'cursor-default border-onyx/50 text-stone-500 bg-stone-50/[0.02]' : values.companySize === size ? 'cursor-pointer border-peach text-stone-50 bg-peach/10 shadow-[0_0_12px_rgba(255,126,117,0.35)]' : 'cursor-pointer border-onyx text-stone-200 bg-stone-50/5 hover:bg-stone-50/10'}`}>{size}</button>)}
                  </div>
                  <p id="demo-gate-too-small" aria-live="polite" className="mt-2.5 text-sm text-stone-400">{tooSmall ? 'This preview works best for teams of 10 or more.' : ''}</p>
                  {errors.companySize && <p className="mt-1.5 text-sm text-coral">{errors.companySize}</p>}
                </div>
              </div>
              <button type="submit" disabled={tooSmall} className={tooSmall ? 'mt-6 md:mt-8 w-full border text-center pt-4 pb-3.5 px-8 rounded-lg cursor-not-allowed border-stone-700 text-stone-500 bg-stone-50/5' : actionClass}>Continue to booking →</button>
            </>}
          </form>
        </div>
      </div>
    </div>, document.body);
}
