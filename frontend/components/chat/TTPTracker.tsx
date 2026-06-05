import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Message } from '@/services/aiService';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

interface DetectedTTP {
  id: string;
  name: string;
  tactic: string;
  tacticColor: string;
  confidence: number;
  context: string;
}

// TTP detection patterns mapped to MITRE
const TTP_PATTERNS: {
  id: string;
  name: string;
  tactic: string;
  tacticColor: string;
  patterns: RegExp[];
}[] = [
  // Recon
  { id: 'T1595', name: 'Active Scanning', tactic: 'Recon', tacticColor: '#3399ff', patterns: [/nmap|masscan|zmap|rustscan|portscan/i] },
  { id: 'T1596', name: 'Search Open Sources', tactic: 'Recon', tacticColor: '#3399ff', patterns: [/shodan|censys|fofa|osint|google.dork/i] },
  { id: 'T1590', name: 'Gather Victim Info', tactic: 'Recon', tacticColor: '#3399ff', patterns: [/whois|subfinder|amass|dnsx|enum.sub/i] },
  // Initial Access
  { id: 'T1566', name: 'Phishing', tactic: 'Initial Access', tacticColor: '#ff44aa', patterns: [/phish|spear.?phish|gophish|evilginx|html.smuggl/i] },
  { id: 'T1190', name: 'Exploit Public App', tactic: 'Initial Access', tacticColor: '#ff44aa', patterns: [/web.exploit|sqli|rce|lfi|rfi|deseri/i] },
  { id: 'T1078', name: 'Valid Accounts', tactic: 'Initial Access', tacticColor: '#ff44aa', patterns: [/credential.stuff|password.spray|brute.forc/i] },
  // Execution
  { id: 'T1059', name: 'Command Interpreter', tactic: 'Execution', tacticColor: '#aa44ff', patterns: [/powershell|cmd\.exe|bash|python|wscript|cscript/i] },
  { id: 'T1106', name: 'Native API', tactic: 'Execution', tacticColor: '#aa44ff', patterns: [/winapi|createprocess|shellexecute|ntcreate/i] },
  { id: 'T1204', name: 'User Execution', tactic: 'Execution', tacticColor: '#aa44ff', patterns: [/macro|vba|lnk.file|iso.mount|hta./i] },
  // Persistence
  { id: 'T1053', name: 'Scheduled Task', tactic: 'Persistence', tacticColor: '#ff8800', patterns: [/schtask|cron|at\.exe|launchd|systemd/i] },
  { id: 'T1547', name: 'Boot Autostart', tactic: 'Persistence', tacticColor: '#ff8800', patterns: [/registry.run|hklm.run|startup.fold|reg.add/i] },
  { id: 'T1505', name: 'Server Software Comp', tactic: 'Persistence', tacticColor: '#ff8800', patterns: [/webshell|php.shell|aspx.shell|jsp.shell/i] },
  // PrivEsc
  { id: 'T1548', name: 'Abuse Elevation', tactic: 'Priv Esc', tacticColor: '#ffcc00', patterns: [/uac.bypass|bypassuac|fodhelper|eventvwr/i] },
  { id: 'T1055', name: 'Process Injection', tactic: 'Priv Esc', tacticColor: '#ffcc00', patterns: [/inject|dll.inject|hollow|reflective|apc.queue/i] },
  { id: 'T1068', name: 'Exploit for PrivEsc', tactic: 'Priv Esc', tacticColor: '#ffcc00', patterns: [/kernel.exploit|local.priv|potato|juicy|rogue/i] },
  // Defense Evasion
  { id: 'T1562', name: 'Impair Defenses', tactic: 'Def Evasion', tacticColor: '#00ff41', patterns: [/disable.defender|kill.av|tamper|amsi.bypass|etw/i] },
  { id: 'T1070', name: 'Indicator Removal', tactic: 'Def Evasion', tacticColor: '#00ff41', patterns: [/clear.log|wevtutil|delete.log|stomp|timestomp/i] },
  { id: 'T1027', name: 'Obfuscated Files', tactic: 'Def Evasion', tacticColor: '#00ff41', patterns: [/obfuscat|encode|pack|encrypt.payload|xor.key/i] },
  // Credential Access
  { id: 'T1003', name: 'OS Cred Dumping', tactic: 'Cred Access', tacticColor: '#ff6600', patterns: [/mimikatz|lsass|sekurlsa|dcsync|hashdump/i] },
  { id: 'T1558', name: 'Steal Kerberos', tactic: 'Cred Access', tacticColor: '#ff6600', patterns: [/kerberoast|asrep.roast|rubeus|impacket.get/i] },
  { id: 'T1552', name: 'Unsecured Credentials', tactic: 'Cred Access', tacticColor: '#ff6600', patterns: [/find.password|grep.pass|search.cred|unattend.xml/i] },
  // Lateral Movement
  { id: 'T1021', name: 'Remote Services', tactic: 'Lateral Move', tacticColor: '#00ccff', patterns: [/psexec|wmiexec|smbexec|rdp|ssh.lateral|winrm/i] },
  { id: 'T1550', name: 'Use Alt Auth', tactic: 'Lateral Move', tacticColor: '#00ccff', patterns: [/pass.the.hash|pass.the.ticket|pth|ptt|overpass/i] },
  // C2
  { id: 'T1071', name: 'App Layer Protocol', tactic: 'C2', tacticColor: '#cc44ff', patterns: [/dns.c2|http.c2|beacon|c2.channel|domain.front/i] },
  { id: 'T1572', name: 'Protocol Tunneling', tactic: 'C2', tacticColor: '#cc44ff', patterns: [/tunnel|chisel|ligolo|socks.proxy|ngrok|frp/i] },
  // Exfil
  { id: 'T1048', name: 'Exfil Over Alt Proto', tactic: 'Exfiltration', tacticColor: '#ff2222', patterns: [/exfil|dns.exfil|icmp.exfil|data.theft|steal.data/i] },
];

function detectTTPs(messages: Message[]): DetectedTTP[] {
  const content = messages
    .filter(m => m.role !== 'system')
    .slice(-10)
    .map(m => m.content)
    .join(' ');

  if (!content.trim()) return [];

  const detected: DetectedTTP[] = [];
  const seen = new Set<string>();

  for (const ttp of TTP_PATTERNS) {
    for (const pattern of ttp.patterns) {
      const match = content.match(pattern);
      if (match && !seen.has(ttp.id)) {
        seen.add(ttp.id);
        // Confidence based on message recency weight
        const recentContent = messages
          .filter(m => m.role !== 'system')
          .slice(-3)
          .map(m => m.content)
          .join(' ');
        const confidence = pattern.test(recentContent) ? 95 : 70;
        detected.push({
          id: ttp.id,
          name: ttp.name,
          tactic: ttp.tactic,
          tacticColor: ttp.tacticColor,
          confidence,
          context: match[0].slice(0, 20),
        });
        break;
      }
    }
  }

  return detected.sort((a, b) => b.confidence - a.confidence);
}

interface TTPTrackerProps {
  messages: Message[];
  visible: boolean;
  onClose: () => void;
}

export function TTPTracker({ messages, visible, onClose }: TTPTrackerProps) {
  const ttps = useMemo(() => detectTTPs(messages), [messages]);

  if (!visible) return null;

  // Group by tactic
  const grouped = ttps.reduce<Record<string, DetectedTTP[]>>((acc, ttp) => {
    if (!acc[ttp.tactic]) acc[ttp.tactic] = [];
    acc[ttp.tactic].push(ttp);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="account-tree" size={14} color={Colors.accent} />
        <Text style={styles.title}>TTP TRACKER</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{ttps.length}</Text>
        </View>
        <Text style={styles.subtitle}>Live MITRE ATT&CK Map</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <MaterialIcons name="close" size={16} color={Colors.textMuted} />
        </Pressable>
      </View>

      {ttps.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="search" size={20} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No TTPs detected yet</Text>
          <Text style={styles.emptyHint}>Chat about techniques to map them</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
          {Object.entries(grouped).map(([tactic, items]) => {
            const color = items[0].tacticColor;
            return (
              <View key={tactic} style={styles.tacticGroup}>
                <View style={styles.tacticHeader}>
                  <View style={[styles.tacticDot, { backgroundColor: color }]} />
                  <Text style={[styles.tacticName, { color }]}>{tactic.toUpperCase()}</Text>
                  <View style={[styles.tacticCount, { backgroundColor: color + '22', borderColor: color + '44' }]}>
                    <Text style={[styles.tacticCountText, { color }]}>{items.length}</Text>
                  </View>
                </View>
                {items.map(ttp => (
                  <View key={ttp.id} style={styles.ttpRow}>
                    <View style={[styles.ttpIdBadge, { borderColor: color + '44', backgroundColor: color + '0d' }]}>
                      <Text style={[styles.ttpId, { color }]}>{ttp.id}</Text>
                    </View>
                    <View style={styles.ttpInfo}>
                      <Text style={styles.ttpName}>{ttp.name}</Text>
                      <View style={styles.confidenceRow}>
                        <View style={styles.confidenceTrack}>
                          <View style={[styles.confidenceFill, { width: `${ttp.confidence}%` as any, backgroundColor: color }]} />
                        </View>
                        <Text style={[styles.confidenceText, { color }]}>{ttp.confidence}%</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.accent + '33',
    maxHeight: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  title: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '700' as any,
    letterSpacing: 1.5,
  },
  countBadge: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
  },
  countText: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: '700' as any,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 9,
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 6,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  list: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  tacticGroup: {
    marginBottom: Spacing.sm,
  },
  tacticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  tacticDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tacticName: {
    fontSize: 9,
    fontWeight: '700' as any,
    letterSpacing: 1,
    flex: 1,
  },
  tacticCount: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
  },
  tacticCountText: {
    fontSize: 9,
    fontWeight: '700' as any,
  },
  ttpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 5,
    paddingLeft: 12,
  },
  ttpIdBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  ttpId: {
    fontSize: 9,
    fontWeight: '700' as any,
    letterSpacing: 0.5,
  },
  ttpInfo: {
    flex: 1,
    gap: 3,
  },
  ttpName: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: Typography.medium,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  confidenceTrack: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: 3,
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 9,
    fontWeight: '700' as any,
    minWidth: 24,
    textAlign: 'right',
  },
});
