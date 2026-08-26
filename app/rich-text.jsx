/* Safe rich-text presentation/editor over the existing authoritative text field.
   The compact Markdown subset is rendered as React nodes; no HTML is injected. */
(function(){
  'use strict';
  const {useRef}=React;
  const I=window.Icon;
  function safeHref(raw){try{const url=new URL(raw,window.location.href);return url.protocol==='http:'||url.protocol==='https:'?url.href:null;}catch(_){return null;}}
  function inline(text,key){
    const pattern=/(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;let cursor=0,part=0,nodes=[];String(text||'').replace(pattern,(match,offset)=>{
      if(offset>cursor)nodes.push(String(text).slice(cursor,offset));
      if(match.startsWith('**'))nodes.push(React.createElement('strong',{key:key+'-b-'+part++},match.slice(2,-2)));
      else if(match.startsWith('_'))nodes.push(React.createElement('em',{key:key+'-i-'+part++},match.slice(1,-1)));
      else {const pivot=match.lastIndexOf(']('),href=safeHref(match.slice(pivot+2,-1));nodes.push(href?React.createElement('a',{key:key+'-a-'+part++,href,target:'_blank',rel:'noopener noreferrer',style:{color:'var(--guinda)',fontWeight:750}},match.slice(1,pivot)):match);}
      cursor=offset+match.length;return match;
    });if(cursor<String(text||'').length)nodes.push(String(text).slice(cursor));return nodes.length?nodes:String(text||'');
  }
  function RichText({value}){
    const lines=String(value||'').split(/\r?\n/),out=[];let list=[];
    const flush=()=>{if(!list.length)return;const start=out.length;out.push(React.createElement('ul',{key:'ul-'+start,style:{margin:'0 0 14px',paddingLeft:22}},list.map((line,index)=>React.createElement('li',{key:index,style:{marginBottom:5}},inline(line,'li-'+start+'-'+index)))));list=[];};
    lines.forEach((raw,index)=>{const line=raw.trim();if(/^[-*] /.test(line)){list.push(line.slice(2));return;}flush();if(!line)return;if(/^##? /.test(line)){const level=line.startsWith('## ')?3:2;out.push(React.createElement('h'+level,{key:index,style:{fontSize:level===2?20:17,fontWeight:850,lineHeight:1.3,margin:'18px 0 9px',color:'var(--ink)'}},inline(line.replace(/^##? /,''),'h-'+index)));}else out.push(React.createElement('p',{key:index,style:{margin:'0 0 14px'}},inline(line,'p-'+index)));});flush();
    return React.createElement('div',{'data-rich-text':'rendered','data-structured-content':'rich-text'},out);
  }
  function RichTextEditor({value,onChange,style}){
    const ref=useRef(null);
    const latest=useRef(String(value||''));latest.current=String(value||'');
    const commit=(next)=>{latest.current=next;onChange(next);};
    const wrap=(before,after)=>{const el=ref.current;if(!el)return;const current=latest.current,start=el.selectionStart,end=el.selectionEnd,selected=current.slice(start,end),next=current.slice(0,start)+before+selected+after+current.slice(end);commit(next);requestAnimationFrame(()=>{el.focus();const from=start+before.length;el.setSelectionRange(from,from+selected.length);});};
    const prefix=(token)=>{const el=ref.current;if(!el)return;const current=latest.current,start=el.selectionStart,lineStart=current.lastIndexOf('\n',Math.max(0,start-1))+1,next=current.slice(0,lineStart)+token+current.slice(lineStart);commit(next);requestAnimationFrame(()=>{el.focus();const caret=start+token.length;el.setSelectionRange(caret,caret);});};
    const button=(icon,label,action)=>React.createElement('button',{type:'button',onClick:action,'aria-label':label,title:label,style:{width:36,height:34,border:'none',borderRadius:9,background:'var(--surface)',color:'var(--ink-2)',display:'grid',placeItems:'center',cursor:'pointer'}},React.createElement(I,{name:icon,size:16,stroke:2.2}));
    return React.createElement('div',{'data-rich-text-editor':'enabled',style:{borderRadius:13,background:'var(--surface-2)',boxShadow:'var(--neo-inset)',overflow:'hidden'}},
      React.createElement('div',{style:{display:'flex',gap:6,padding:'7px 8px',borderBottom:'1px solid var(--hairline)'}},
        button('doc','Negrita',()=>wrap('**','**')),
        button('pencil','Cursiva',()=>wrap('_','_')),
        button('news','Título',()=>prefix('## ')),
        button('menu','Lista',()=>prefix('- ')),
        button('link','Enlace',()=>wrap('[','](https://)'))),
      React.createElement('textarea',{ref,value,onChange:e=>commit(e.target.value),rows:8,placeholder:'Escribe el artículo. Usa la barra para dar formato.',style:Object.assign({width:'100%',border:'none',outline:'none',background:'transparent',padding:'13px 14px',fontSize:14.5,fontFamily:'inherit',color:'var(--ink)',boxSizing:'border-box',resize:'vertical',minHeight:160,lineHeight:1.55},style||{})}));
  }
  Object.assign(window,{RichText,RichTextEditor});
})();
