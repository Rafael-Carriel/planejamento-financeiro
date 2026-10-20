'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {client}=require('../asaas');
test('transporte Asaas não segue redirecionamentos com credencial privada',async()=>{
  const previous=global.fetch; let captured;
  global.fetch=async(url,options)=>{captured={url,options};return new Response(JSON.stringify({data:[]}),{status:200});};
  try{
    await client({ASAAS_ENV:'sandbox',ASAAS_API_KEY:'fake-secret'})('/customers?limit=1');
    assert.equal(captured.url,'https://api-sandbox.asaas.com/v3/customers?limit=1');
    assert.equal(captured.options.redirect,'error');
    assert.equal(captured.options.headers.access_token,'fake-secret');
    assert.ok(captured.options.signal instanceof AbortSignal);
  }finally{global.fetch=previous;}
});
test('erros externos não expõem resposta privada ao cliente',async()=>{
  const previous=global.fetch;
  global.fetch=async()=>new Response(JSON.stringify({cpf:'private-test',secret:'hidden'}),{status:400});
  try{await assert.rejects(()=>client({ASAAS_ENV:'production',ASAAS_API_KEY:'fake-secret'})('/payments'),error=>error.status===502&&!error.message.includes('private-test')&&!error.message.includes('hidden'));}
  finally{global.fetch=previous;}
});
