import { useRef, useState } from 'react';
import { Home, MessageCircle, X, Send, Smile, Paperclip, AudioLines, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState('');
  const [notice, setNotice] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  return <div className="support-widget">
    {open && <section className="support-panel" role="dialog" aria-label="Chat MenteExperta">
      <div className="support-top">
        <div className="support-tabs">
          <Button size="icon" variant="ghost" aria-label="Início do chat" onClick={() => setNotice(false)}><Home size={15}/></Button>
          <span className="support-tab"><MessageCircle size={15} fill="currentColor"/> Mensagens</span>
          <Button size="icon" variant="ghost" aria-label="Fechar chat" onClick={() => setOpen(false)}><X size={17}/></Button>
        </div>
        <div className="support-avatars"><span>ME</span><span className="support-avatar-green">M</span><span className="support-avatar-brand">mente<br/>experta</span></div>
        <h2>Dúvidas? Fale connosco.</h2>
        <p>Atendimento ainda não conectado</p>
      </div>
      <div className="support-transcript" aria-live="polite">
        <div className="support-greeting"><span className="support-mini-logo">me</span><p>Como podemos ajudar com a MenteExperta?</p></div>
        {notice && <p className="support-notice">Sua mensagem não foi enviada. O atendimento estará disponível quando o canal de contacto for conectado.</p>}
      </div>
      <form className="support-composer" onSubmit={e => {e.preventDefault(); if (message.trim() || attachment) setNotice(true);}}>
        <textarea aria-label="Sua mensagem" placeholder="Escreva a sua mensagem..." value={message} onChange={e => setMessage(e.target.value)} />
        {attachment && <p className="support-attachment">{attachment}<Button size="icon" variant="ghost" aria-label="Remover anexo" onClick={() => setAttachment('')}><X/></Button></p>}
        <div className="support-tools">
          <Button size="icon" variant="ghost" title="Adicionar emoji" aria-label="Adicionar emoji" onClick={() => setMessage(m => m + ' 🙂')}><Smile/></Button>
          <Button size="icon" variant="ghost" title="Anexar ficheiro" aria-label="Anexar ficheiro" onClick={() => file.current?.click()}><Paperclip/></Button>
          <Button size="icon" variant="ghost" title="Áudio indisponível" aria-label="Áudio indisponível" disabled><AudioLines/></Button>
          <input type="file" hidden ref={file} onChange={e => setAttachment(e.target.files?.[0]?.name ?? '')}/>
          <Button type="submit" size="icon" variant="ghost" className="support-send" aria-label="Enviar mensagem" disabled={!message.trim() && !attachment}><Send fill="currentColor"/></Button>
        </div>
      </form>
      <div className="support-footer">MenteExperta · Atendimento</div>
    </section>}
    <Button className="support-launcher" aria-label={open ? 'Minimizar chat' : 'Abrir chat'} onClick={() => setOpen(!open)}>{open ? <ChevronDown/> : <MessageCircle fill="currentColor"/>}</Button>
  </div>;
}
