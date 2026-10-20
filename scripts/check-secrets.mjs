import {execFileSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\$aact_(?:prod|hmlg)_[A-Za-z0-9_]{15,}/,/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/];
const failures=[];
for(const path of new Set(files)){
  if(!statSync(path).isFile()) continue;
  const bytes=readFileSync(path); if(bytes.includes(0)) continue;
  if(patterns.some(pattern=>pattern.test(bytes.toString('utf8')))) failures.push(path);
}
if(failures.length){console.error('Possíveis credenciais privadas. Revisar arquivos, sem publicar valores:\n'+failures.join('\n'));process.exitCode=1;}
else console.log('PASS: nenhum segredo privado reconhecido nos arquivos versionados ou candidatos. Configurações públicas não são credenciais de servidor.');
