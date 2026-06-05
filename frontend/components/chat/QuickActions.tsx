import React, { useState } from 'react';
import { ScrollView, Pressable, Text, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

type Category = 'Recon' | 'Exploit' | 'PostEx' | 'Evasion' | 'Cloud' | 'HW';

interface QuickAction {
  label: string;
  icon: string;
  category: Category;
  color: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  // Recon
  { label: 'External Recon', icon: 'radar', category: 'Recon', color: '#3399ff',
    prompt: 'Generate a comprehensive external recon plan: passive DNS, cert transparency, ASN mapping, Shodan/Censys queries, GitHub secret scanning, and subdomain enumeration with tool commands.' },
  { label: 'OSINT Framework', icon: 'public', category: 'Recon', color: '#3399ff',
    prompt: 'Build a full OSINT campaign: social media enumeration, LinkedIn employee scraping, data breach lookups, dark web mentions, pastebin monitoring, and Wayback Machine analysis.' },
  { label: 'Cloud Footprint', icon: 'cloud-queue', category: 'Recon', color: '#3399ff',
    prompt: 'Enumerate cloud attack surface: exposed S3 buckets, Azure blobs, GCP storage, exposed APIs, misconfigured IAM policies, and cloud metadata service abuse vectors.' },

  // Exploit
  { label: 'AD Compromise', icon: 'account-tree', category: 'Exploit', color: '#cc2222',
    prompt: 'Full Active Directory compromise path from initial foothold to domain admin. Include: BloodHound analysis, Kerberoasting, AS-REP Roasting, ACL abuse, DCSync, Golden Ticket. Provide Impacket/Rubeus commands.' },
  { label: 'Web App Pwn', icon: 'web', category: 'Exploit', color: '#cc2222',
    prompt: 'Web application exploitation chain: SQLi to RCE, SSRF to cloud metadata, XSS to account takeover, SSTI, deserialization, and file upload bypass techniques with payloads.' },
  { label: 'Cloud PrivEsc', icon: 'cloud-done', category: 'Exploit', color: '#cc2222',
    prompt: 'Cloud privilege escalation paths: AWS IAM enumeration to admin, Azure role escalation, GCP service account abuse, IMDS token theft, cross-account pivoting, and container escapes.' },

  // Post-Exploitation
  { label: 'Credential Dump', icon: 'key', category: 'PostEx', color: '#ff8800',
    prompt: 'Comprehensive credential harvesting playbook: LSASS dump via multiple methods, SAM/NTDS extraction, DPAPI decryption, browser credential theft, and Kerberos ticket extraction with Mimikatz/Rubeus.' },
  { label: 'Persistence Kit', icon: 'settings-backup-restore', category: 'PostEx', color: '#ff8800',
    prompt: 'Full persistence toolkit across platforms: Windows (registry, WMI, COM hijacking, DLL planting, BITS), Linux (cron, systemd, LD_PRELOAD, PAM), and macOS (LaunchAgents, dylib hijack).' },
  { label: 'Lateral Matrix', icon: 'device-hub', category: 'PostEx', color: '#ff8800',
    prompt: 'Network lateral movement matrix: PtH/PtT attacks, PSExec/WMIExec/SMBExec, SSH pivoting, chisel/ligolo-ng tunneling, Kerberos delegation abuse, and constrained delegation exploitation.' },

  // Evasion
  { label: 'AV/EDR Bypass', icon: 'visibility-off', category: 'Evasion', color: '#00cc44',
    prompt: 'Modern AV/EDR evasion: AMSI bypass techniques, ETW patching, direct syscalls via SysWhispers, process injection (hollowing, stomping, APC), living-off-the-land binaries, and obfuscation with Chameleon/Invoke-Obfuscation.' },
  { label: 'C2 OPSEC', icon: 'router', category: 'Evasion', color: '#00cc44',
    prompt: 'C2 infrastructure with OPSEC: domain fronting via CDN, Cobalt Strike/Havoc/Sliver malleable profiles, JA3/JARM evasion, DNS-over-HTTPS C2, legitimate cloud service abuse, and traffic blending.' },
  { label: 'Log Stomping', icon: 'delete-sweep', category: 'Evasion', color: '#00cc44',
    prompt: 'Forensic artifact removal: Windows event log clearing, Sysmon bypass, prefetch/shimcache manipulation, $MFT timestamp forgery, Linux log wiping (/var/log/*, utmp/wtmp), and memory-only operations.' },

  // Cloud & Identity
  { label: 'Identity Pivot', icon: 'swap-horiz', category: 'Cloud', color: '#aa44ff',
    prompt: 'Advanced identity and cloud pivot vectors: federated identity abuse, OIDC token theft, OAuth implicit flow attacks, Azure AD PRT theft, conditional access bypass, and cross-tenant attack paths.' },
  { label: 'Container Escape', icon: 'logout', category: 'Cloud', color: '#aa44ff',
    prompt: 'Container and Kubernetes attack chains: Docker socket abuse, privileged container escape, hostPath mount exploitation, RBAC misconfiguration, etcd access, and service account token theft for cluster admin.' },

  // Hardware & Fuzzing
  { label: 'HW Implants', icon: 'developer-board', category: 'HW', color: '#ff44aa',
    prompt: 'Hardware implant tradecraft: USB HID implants (Rubber Ducky, O.MG cable), network taps (LAN Turtle, Packet Squirrel), firmware backdoors, PCIe implants, supply chain hardware tampering, and implant C2 channels.' },
  { label: 'Protocol Fuzz', icon: 'bluetooth-searching', category: 'HW', color: '#ff44aa',
    prompt: 'Protocol fuzzing methodology: network protocol fuzzing with Boofuzz/Sulley, Bluetooth/BLE fuzzing, CAN bus attacks for automotive, ICS/SCADA protocol abuse (Modbus, DNP3), and custom fuzzer development.' },
];

const CATEGORIES: { id: Category | 'All'; label: string; color: string }[] = [
  { id: 'All', label: 'ALL', color: Colors.textSecondary },
  { id: 'Recon', label: 'RECON', color: '#3399ff' },
  { id: 'Exploit', label: 'XPLOIT', color: '#cc2222' },
  { id: 'PostEx', label: 'POST-EX', color: '#ff8800' },
  { id: 'Evasion', label: 'EVASION', color: '#00cc44' },
  { id: 'Cloud', label: 'CLOUD', color: '#aa44ff' },
  { id: 'HW', label: 'HW/FUZZ', color: '#ff44aa' },
];

interface Props {
  onSelect: (prompt: string) => void;
}

export function QuickActions({ onSelect }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');

  const filtered = activeCategory === 'All'
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter(a => a.category === activeCategory);

  return (
    <View style={styles.wrapper}>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catContent}
        style={styles.catScroll}
      >
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <Pressable
              key={cat.id}
              style={[
                styles.catChip,
                isActive && { borderColor: cat.color + '55', backgroundColor: cat.color + '15' },
              ]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Text style={[styles.catText, isActive && { color: cat.color }]}>{cat.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Action chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsContent}
      >
        {filtered.map((action) => (
          <Pressable
            key={action.label}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: action.color + '44' },
              pressed && { opacity: 0.7, backgroundColor: action.color + '15' },
            ]}
            onPress={() => onSelect(action.prompt)}
          >
            <MaterialIcons name={action.icon as any} size={12} color={action.color} />
            <Text style={[styles.chipText, { color: action.color }]}>{action.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    paddingTop: Spacing.sm,
  },
  catScroll: {
    marginBottom: 6,
  },
  catContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    gap: Spacing.xs,
  },
  catChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  catText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700' as any,
    letterSpacing: 0.8,
  },
  actionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  chipText: {
    fontSize: Typography.xs,
    fontWeight: '600' as any,
  },
});
