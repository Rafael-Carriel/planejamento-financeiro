import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const release=JSON.parse(readFileSync('dist/release.json','utf8'));
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(release.app!=='Planeora'||release.mode!=='production'||release.projectId!=='controle-financeiro-rafael'||release.supportConfigured!==true||release.revision!==revision) {
  throw new Error('Publicação recusada: refaça o build de produção com SAC configurado e projeto original.');
}
console.log('Build de produção conferido: Planeora, projeto original e revisão atual.');
