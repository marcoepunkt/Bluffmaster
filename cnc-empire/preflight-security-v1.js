(()=>{
  const GAME_KEYS=['cncEmpireMobileV2','cncEmpireMobileV1'];
  const cleanName=(value,max=30)=>String(value??'')
    .replace(/[<>]/g,'')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .trim()
    .slice(0,max);

  function sanitizeState(state){
    if(!state||typeof state!=='object')return state;
    if(typeof state.name==='string')state.name=cleanName(state.name,22)||'Meine Werkstatt';
    if(Array.isArray(state.friends)){
      state.friends=state.friends.map(friend=>{
        if(!friend||typeof friend!=='object')return friend;
        return {...friend,n:cleanName(friend.n,30)||'Werkstatt'};
      });
    }
    return state;
  }

  const isEditable=el=>!!el&&(
    el.matches?.('input,textarea,select')||el.isContentEditable
  );
  const refreshInputFocus=()=>{
    window.CNC_INPUT_FOCUS=isEditable(document.activeElement);
  };
  window.CNC_INPUT_FOCUS=false;
  document.addEventListener('focusin',refreshInputFocus,true);
  document.addEventListener('focusout',()=>queueMicrotask(refreshInputFocus),true);

  const innerHTMLDescriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  if(innerHTMLDescriptor?.get&&innerHTMLDescriptor?.set&&innerHTMLDescriptor.configurable){
    Object.defineProperty(Element.prototype,'innerHTML',{
      ...innerHTMLDescriptor,
      set(value){
        const active=document.activeElement;
        if(this.id==='root'&&isEditable(active)&&this.contains(active))return;
        return innerHTMLDescriptor.set.call(this,value);
      }
    });
  }

  const nativeSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    if(GAME_KEYS.includes(String(key))){
      try{
        const state=sanitizeState(JSON.parse(String(value)));
        return nativeSetItem.call(this,key,JSON.stringify(state));
      }catch{}
    }
    return nativeSetItem.call(this,key,value);
  };

  for(const key of GAME_KEYS){
    try{
      const raw=localStorage.getItem(key);
      if(!raw)continue;
      const state=sanitizeState(JSON.parse(raw));
      nativeSetItem.call(localStorage,key,JSON.stringify(state));
    }catch{}
  }

  document.addEventListener('input',event=>{
    const el=event.target;
    if(el&&el.id==='nm')el.value=cleanName(el.value,22);
  },true);

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    let requestInput=input;
    let url=typeof input==='string'?input:(input?.url||'');
    if(typeof requestInput==='string'&&/\.\/v3part[1-7]\.txt\?v=7(?:&|$)/.test(requestInput)){
      requestInput=requestInput.replace('?v=7','?v=8');
      url=requestInput;
    }
    const isProfileApi=url.includes('/rest/v1/player_profiles_s2');
    let nextInit=init;

    if(isProfileApi&&typeof init?.body==='string'){
      try{
        const body=JSON.parse(init.body);
        if(body&&typeof body==='object'&&typeof body.display_name==='string'){
          body.display_name=cleanName(body.display_name,22)||'Meine Werkstatt';
          nextInit={...init,body:JSON.stringify(body)};
        }
      }catch{}
    }

    const response=await nativeFetch(requestInput,nextInit);
    const method=String(nextInit?.method||'GET').toUpperCase();
    if(!isProfileApi||method!=='GET'||!response.ok)return response;

    try{
      const data=await response.clone().json();
      const sanitizeRow=row=>row&&typeof row==='object'
        ?{...row,display_name:cleanName(row.display_name,30)||'Werkstatt'}
        :row;
      const safe=Array.isArray(data)?data.map(sanitizeRow):sanitizeRow(data);
      const headers=new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      return new Response(JSON.stringify(safe),{
        status:response.status,
        statusText:response.statusText,
        headers
      });
    }catch{
      return response;
    }
  };
})();
