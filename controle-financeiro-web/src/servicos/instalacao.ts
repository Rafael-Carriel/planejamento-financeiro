// Capture before React and the dynamic application import finish loading.
export interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let evento: EventoInstalacao | null = null;
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach(ouvinte => ouvinte());
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  evento = e as EventoInstalacao;
  notificar();
});
window.addEventListener('appinstalled', () => { evento = null; notificar(); });
export const lerEventoInstalacao = () => evento;
export function observarInstalacao(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
}
export function consumirEventoInstalacao() {
  const atual = evento;
  evento = null;
  notificar();
  return atual;
}
