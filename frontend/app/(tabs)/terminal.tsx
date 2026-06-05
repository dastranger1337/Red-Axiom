/**
 * TERMINAL — Real Linux Execution Environment
 * Powered by Piston API: real sandboxed Linux, multi-language, network access
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { appendExecLog } from '@/services/executionLog';
import { useChatContext } from '@/hooks/useChatContext';

// ── Language runtime config ────────────────────────────────────────────────────
const LANGS = [
  { id: 'bash',       label: 'bash',  color: '#00ff41', ext: 'sh'  },
  { id: 'python',     label: 'py',    color: '#3776ab', ext: 'py'  },
  { id: 'javascript', label: 'node',  color: '#f7df1e', ext: 'js'  },
  { id: 'typescript', label: 'ts',    color: '#3178c6', ext: 'ts'  },
  { id: 'go',         label: 'go',    color: '#00add8', ext: 'go'  },
  { id: 'rust',       label: 'rust',  color: '#dea584', ext: 'rs'  },
  { id: 'ruby',       label: 'ruby',  color: '#cc342d', ext: 'rb'  },
  { id: 'c',          label: 'c',     color: '#a8b9cc', ext: 'c'   },
  { id: 'cpp',        label: 'c++',   color: '#659ad2', ext: 'cpp' },
  { id: 'php',        label: 'php',   color: '#8993be', ext: 'php' },
  { id: 'perl',       label: 'perl',  color: '#39457e', ext: 'pl'  },
  { id: 'lua',        label: 'lua',   color: '#000080', ext: 'lua' },
  { id: 'powershell', label: 'pwsh',  color: '#5391fe', ext: 'ps1' },
];

// ── Syntax highlight tokens ───────────────────────────────────────────────────
const BASH_KEYWORDS = /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|in|local|export|readonly|unset|source|alias|echo|printf|cat|ls|cd|pwd|mkdir|rm|cp|mv|grep|sed|awk|find|chmod|chown|curl|wget|ssh|sudo|su|apt|pip|npm|python|python3|node|bash|sh|exit|true|false|read)\b/g;
const BASH_FLAGS = /(?<!\w)-{1,2}[\w-]+/g;
const BASH_STRING_D = /"([^"\\]|\\.)*"/g;
const BASH_STRING_S = /'([^'\\]|\\.)*'/g;
const BASH_COMMENT = /#.*/g;
const BASH_VAR = /\$[\w{}\(\)]+/g;
const BASH_PIPE = /[|&><;]/g;
const BASH_NUM = /\b\d+(\.\d+)?\b/g;

interface TokenSpan { text: string; color: string }

function highlightBash(code: string): TokenSpan[] {
  if (!code.trim()) return [{ text: code, color: '#00ff41' }];

  const spans: TokenSpan[] = [];
  const ranges: { start: number; end: number; color: string }[] = [];

  const addRanges = (re: RegExp, color: string) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length, color });
    }
  };

  addRanges(BASH_COMMENT, '#666666');
  addRanges(BASH_STRING_D, '#98c379');
  addRanges(BASH_STRING_S, '#98c379');
  addRanges(BASH_VAR, '#e5c07b');
  addRanges(BASH_KEYWORDS, '#c678dd');
  addRanges(BASH_FLAGS, '#56b6c2');
  addRanges(BASH_NUM, '#d19a66');
  addRanges(BASH_PIPE, '#61afef');

  ranges.sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];
  for (const r of ranges) {
    if (merged.length && r.start < merged[merged.length - 1].end) continue;
    merged.push(r);
  }

  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) spans.push({ text: code.slice(cursor, r.start), color: '#00ff41' });
    spans.push({ text: code.slice(r.start, r.end), color: r.color });
    cursor = r.end;
  }
  if (cursor < code.length) spans.push({ text: code.slice(cursor), color: '#00ff41' });
  return spans;
}

// ── Helper: build output from parts ─────────────────────────────────────────
function buildOutputFromParts(json: any): string {
  const parts: string[] = [];
  if (json.compileStderr) parts.push(`[COMPILE ERROR]\n${json.compileStderr.trim()}`);
  if (json.compileStdout) parts.push(`[COMPILE]\n${json.compileStdout.trim()}`);
  if (json.stdout) parts.push(json.stdout.trimEnd());
  if (json.stderr && (json.exitCode !== 0 || !json.stdout)) parts.push(`[STDERR]\n${json.stderr.trim()}`);
  if (json.signal) parts.push(`[KILLED] Signal: ${json.signal}`);
  else if (json.exitCode !== 0 && json.exitCode != null) parts.push(`[EXIT ${json.exitCode}]`);
  return parts.join('\n');
}

// ── Built-in command suggestions ──────────────────────────────────────────────
const SUGGESTIONS: Record<string, string[]> = {
  'uname': ['uname -a', 'uname -r', 'uname -m'],
  'ls': ['ls -la', 'ls -lh', 'ls /proc', 'ls /etc'],
  'cat': ['cat /etc/passwd', 'cat /etc/os-release', 'cat /proc/version'],
  'curl': ['curl -s https://httpbin.org/get', 'curl -I https://example.com', 'curl -s https://api.ipify.org'],
  'wget': ['wget -q -O- https://example.com'],
  'python': ['python3 -c "import sys; print(sys.version)"', 'python3 -c "import os; print(os.uname())"'],
  'python3': ['python3 -c "import sys; print(sys.version)"'],
  'pip': ['pip list', 'pip install requests', 'pip install numpy'],
  'npm': ['npm --version', 'npm install axios'],
  'node': ['node -e "console.log(process.version)"'],
  'ip': ['ip a', 'ip route'],
  'whoami': ['whoami'],
  'id': ['id'],
  'ps': ['ps aux', 'ps -ef'],
  'env': ['env', 'env | grep PATH'],
  'echo': ['echo $SHELL', 'echo $PATH', 'echo $HOME'],
  'df': ['df -h'],
  'free': ['free -h'],
  'top': ['top -bn1 | head -20'],
  'nmap': ['nmap -sV 127.0.0.1', 'nmap --version'],
  'openssl': ['openssl version', 'openssl rand -hex 32'],
};

// ── Terminal entry ────────────────────────────────────────────────────────────
interface TerminalEntry {
  id: string;
  type: 'command' | 'output' | 'error' | 'system' | 'info';
  text: string;
  lang?: string;
  timestamp: Date;
  duration?: number;
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const BANNER = `AXIOM TERMINAL  v2.5
Real Linux (Container Shell)  |  Bash · Python · Node · Go · Rust · C · C++ · PHP · Ruby · Lua · TypeScript · PowerShell
Network access enabled  |  nmap · nikto · whatweb · sqlmap · masscan · gobuster · hydra · john · hashcat · dig · curl
Type a command and press RUN.  "Run in Terminal" from chat auto-executes code here.
Note: container blocks raw sockets — use "nmap -sT -Pn" for connect scans.
`;

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const { registerTerminalRunner } = useChatContext();

  const [lang, setLang] = useState(LANGS[0]);
  const [input, setInput] = useState('');
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [entries, setEntries] = useState<TerminalEntry[]>([
    { id: 'banner', type: 'system', text: BANNER, timestamp: new Date() },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const addEntry = useCallback((entry: Omit<TerminalEntry, 'id' | 'timestamp'>) => {
    setEntries(prev => [...prev, { ...entry, id: `${Date.now()}-${Math.random()}`, timestamp: new Date() }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  // ── Autocomplete ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!input.trim() || lang.id !== 'bash') { setSuggestions([]); return; }
    const cmd = input.split(' ')[0];
    const matches = Object.keys(SUGGESTIONS).filter(k => k.startsWith(cmd));
    if (!matches.length) { setSuggestions([]); return; }
    const sugs = matches.flatMap(m => SUGGESTIONS[m]).filter(s => s.startsWith(input)).slice(0, 4);
    setSuggestions(sugs);
  }, [input, lang]);

  // ── Core execution logic (used by both UI and "Run in Terminal") ───────────
  const executeCode = useCallback(async (cmd: string, activeLang: typeof LANGS[0]) => {
    if (!cmd.trim()) return;

    setHistory(prev => [cmd, ...prev.filter(h => h !== cmd)].slice(0, 100));
    setHistoryIndex(-1);
    setSuggestions([]);

    const prompt = activeLang.id === 'bash'
      ? `$ ${cmd}`
      : `[${activeLang.label}] ${cmd.split('\n')[0]}${cmd.includes('\n') ? '...' : ''}`;
    addEntry({ type: 'command', text: prompt, lang: activeLang.id });

    setIsRunning(true);
    const t0 = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

      // ── Runtime override: route to local container shell so nmap, curl,
      // ── and other CLI tools actually execute against this chat's shell.
      const runtimeBase =
        process.env.EXPO_PUBLIC_AXIOM_RUNTIME_URL ||
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        '';
      const res = await fetch(
        `${runtimeBase}/api/exec`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ language: activeLang.id, code: cmd, stdin: stdin || undefined }),
          signal: controller.signal,
        }
      );
      clearTimeout(timer);

      const dur = Date.now() - t0;

      // Always try to parse JSON regardless of HTTP status
      let json: any = {};
      try {
        json = await res.json();
      } catch {
        const errText = `HTTP ${res.status} — invalid response`;
        addEntry({ type: 'error', text: `[ERROR] ${errText}`, duration: dur });
        await appendExecLog({ type: 'command', command: cmd, language: activeLang.label, output: errText, isError: true, durationMs: dur, tags: [activeLang.id, 'terminal', 'error'] });
        return;
      }

      // Check for service-level error (no execution attempted)
      if (json.error && !json.output && !json.stdout) {
        const errMsg = json.error;
        addEntry({ type: 'error', text: `[ERROR] ${errMsg}`, duration: dur });
        await appendExecLog({ type: 'command', command: cmd, language: activeLang.label, output: errMsg, isError: true, durationMs: dur, tags: [activeLang.id, 'terminal', 'error'] });
        return;
      }

      // Use the pre-built output string from the edge function if available
      const output = json.output || buildOutputFromParts(json) || '(no output)';
      const isError = json.success === false || (json.exitCode !== 0 && json.exitCode != null && json.exitCode !== undefined) || !!json.signal;
      
      addEntry({ type: isError ? 'error' : 'output', text: output, duration: dur });

      await appendExecLog({
        type: 'command',
        command: cmd,
        language: activeLang.label,
        output,
        isError,
        durationMs: dur,
        tags: [activeLang.id, 'terminal'],
      });
    } catch (err: any) {
      const dur = Date.now() - t0;
      const msg = err?.name === 'AbortError'
        ? 'Execution timed out (25s). The sandbox may be busy — try again.'
        : `Network error: ${err?.message}`;
      addEntry({ type: 'error', text: msg, duration: dur });
    } finally {
      setIsRunning(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [stdin, addEntry]);

  // ── Register runner with chat context for "Run in Terminal" button ─────────
  useEffect(() => {
    registerTerminalRunner((code: string, langId: string) => {
      const matchedLang = LANGS.find(l =>
        l.id === langId ||
        l.id === langId.toLowerCase() ||
        l.label === langId
      ) || LANGS[0];
      setLang(matchedLang);
      setInput(code);
      addEntry({ type: 'info', text: `[AXIOM CHAT] Injected ${matchedLang.label} code — executing...` });
      // Small delay to allow state to settle
      setTimeout(() => executeCode(code, matchedLang), 200);
    });
  }, [registerTerminalRunner, executeCode, addEntry]);

  // ── Execute from input bar ─────────────────────────────────────────────────
  const execute = useCallback(async (code?: string) => {
    const cmd = (code ?? input).trim();
    if (!cmd || isRunning) return;
    setInput('');
    await executeCode(cmd, lang);
  }, [input, lang, isRunning, executeCode]);

  // ── History navigation ─────────────────────────────────────────────────────
  const navigateHistory = useCallback((dir: 'up' | 'down') => {
    if (!history.length) return;
    const next = dir === 'up'
      ? Math.min(historyIndex + 1, history.length - 1)
      : Math.max(historyIndex - 1, -1);
    setHistoryIndex(next);
    setInput(next === -1 ? '' : history[next]);
  }, [history, historyIndex]);

  const clearTerminal = useCallback(() => {
    setEntries([{ id: 'clear', type: 'system', text: 'Terminal cleared.', timestamp: new Date() }]);
  }, []);

  const highlighted = useMemo(() => lang.id === 'bash' ? highlightBash(input) : null, [input, lang]);

  const entryColor = (type: TerminalEntry['type']) => {
    switch (type) {
      case 'command': return lang.color;
      case 'output':  return '#c8c8c8';
      case 'error':   return '#ff5555';
      case 'system':  return '#4af';
      case 'info':    return '#ffaa00';
      default:        return '#c8c8c8';
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.trafficLights}>
            {['#ff5f57', '#febc2e', '#28c840'].map(c => <View key={c} style={[styles.dot, { backgroundColor: c }]} />)}
          </View>
          <Text style={styles.headerTitle}>TERMINAL</Text>
          <View style={[styles.langBadge, { borderColor: lang.color + '55', backgroundColor: lang.color + '18' }]}>
            <Text style={[styles.langBadgeText, { color: lang.color }]}>{lang.label}</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={[styles.liveDot, isRunning && styles.liveDotRunning]} />
            <Text style={styles.liveText}>{isRunning ? 'EXEC' : 'READY'}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setShowHistory(true)} hitSlop={8} style={({ pressed }) => [styles.hdrBtn, pressed && { opacity: 0.6 }]}>
            <MaterialIcons name="history" size={16} color={Colors.textMuted} />
          </Pressable>
          <Pressable onPress={clearTerminal} hitSlop={8} style={({ pressed }) => [styles.hdrBtn, pressed && { opacity: 0.6 }]}>
            <MaterialIcons name="clear-all" size={16} color={Colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={async () => {
              try {
                const content = entries.map(e => e.text).join('\n');
                await Share.share({ message: content, title: 'AXIOM Terminal Output' });
              } catch {}
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.hdrBtn, pressed && { opacity: 0.6 }]}
          >
            <MaterialIcons name="share" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Language bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langBar} style={styles.langBarOuter}>
        {LANGS.map(l => (
          <Pressable
            key={l.id}
            onPress={() => setLang(l)}
            style={[styles.langChip, lang.id === l.id && { borderColor: l.color, backgroundColor: l.color + '22' }]}
          >
            <Text style={[styles.langChipText, lang.id === l.id && { color: l.color }]}>{l.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Terminal Output */}
        <ScrollView
          ref={scrollRef}
          style={styles.output}
          contentContainerStyle={[styles.outputContent, { paddingBottom: insets.bottom + 10 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {entries.map(entry => (
            <View key={entry.id} style={styles.entryRow}>
              <Text style={[
                styles.entryText,
                entry.type === 'command' ? { color: lang.color, fontWeight: '700' } : { color: entryColor(entry.type) },
              ]}>
                {entry.text}
              </Text>
              {entry.duration != null ? (
                <Text style={styles.entryMeta}>{entry.duration}ms</Text>
              ) : null}
            </View>
          ))}
          {isRunning ? (
            <View style={styles.runningRow}>
              <ActivityIndicator size="small" color={lang.color} />
              <Text style={[styles.entryText, { color: lang.color, marginLeft: 8 }]}>executing...</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestRow} keyboardShouldPersistTaps="always">
            {suggestions.map((s, i) => (
              <Pressable key={i} onPress={() => { setInput(s); setSuggestions([]); }} style={styles.suggestChip}>
                <Text style={styles.suggestText}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* STDIN toggle */}
        <Pressable
          onPress={() => setShowStdin(v => !v)}
          style={[styles.stdinToggle, showStdin && { borderColor: Colors.info + '55', backgroundColor: Colors.info + '0a' }]}
        >
          <MaterialIcons name="input" size={12} color={showStdin ? Colors.info : Colors.textMuted} />
          <Text style={[styles.stdinToggleText, showStdin && { color: Colors.info }]}>STDIN</Text>
          {stdin.trim() ? <View style={[styles.stdinDot, { backgroundColor: Colors.info }]} /> : null}
          <MaterialIcons name={showStdin ? 'expand-less' : 'expand-more'} size={14} color={Colors.textMuted} />
        </Pressable>

        {showStdin ? (
          <View style={styles.stdinBox}>
            <TextInput
              style={styles.stdinInput}
              value={stdin}
              onChangeText={setStdin}
              placeholder="stdin data (piped to program)..."
              placeholderTextColor="#444"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
          </View>
        ) : null}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md }]}>
          <View style={styles.historyNav}>
            <Pressable
              onPress={() => navigateHistory('up')}
              disabled={historyIndex >= history.length - 1}
              hitSlop={8}
              style={[styles.navBtn, historyIndex >= history.length - 1 && { opacity: 0.3 }]}
            >
              <MaterialIcons name="keyboard-arrow-up" size={18} color={lang.color} />
            </Pressable>
            <Pressable
              onPress={() => navigateHistory('down')}
              disabled={historyIndex <= -1}
              hitSlop={8}
              style={[styles.navBtn, historyIndex <= -1 && { opacity: 0.3 }]}
            >
              <MaterialIcons name="keyboard-arrow-down" size={18} color={lang.color} />
            </Pressable>
          </View>

          <View style={[styles.inputWrap, { borderColor: lang.color + '55' }]}>
            {highlighted ? (
              <View style={styles.highlightLayer} pointerEvents="none">
                <Text style={styles.highlightText}>
                  {highlighted.map((span, i) => (
                    <Text key={i} style={{ color: span.color }}>{span.text}</Text>
                  ))}
                </Text>
              </View>
            ) : null}
            <TextInput
              ref={inputRef}
              style={[styles.termInput, highlighted ? { color: 'transparent' } : { color: lang.color }]}
              value={input}
              onChangeText={setInput}
              placeholder={lang.id === 'bash' ? '$ enter command...' : `// ${lang.label} code...`}
              placeholderTextColor="#333"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              onSubmitEditing={() => execute()}
              blurOnSubmit={false}
            />
          </View>

          <Pressable
            onPress={() => execute()}
            disabled={!input.trim() || isRunning}
            style={({ pressed }) => [
              styles.runBtn,
              { backgroundColor: lang.color },
              (!input.trim() || isRunning) && styles.runBtnDisabled,
              pressed && { opacity: 0.75 },
            ]}
          >
            {isRunning
              ? <ActivityIndicator size="small" color="#000" />
              : <MaterialIcons name="play-arrow" size={20} color="#000" />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* History Modal */}
      <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '75%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>COMMAND HISTORY</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                {history.length > 0 ? (
                  <Pressable onPress={() => { setHistory([]); setHistoryIndex(-1); setShowHistory(false); }} hitSlop={8}>
                    <MaterialIcons name="delete-sweep" size={18} color={Colors.danger} />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setShowHistory(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={20} color={Colors.textMuted} />
                </Pressable>
              </View>
            </View>
            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <MaterialIcons name="history" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyHistoryText}>No history yet</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {history.map((cmd, i) => (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [styles.historyRow, pressed && { backgroundColor: lang.color + '11' }]}
                    onPress={() => { setInput(cmd); setShowHistory(false); }}
                  >
                    <Text style={styles.historyIndex}>{String(i + 1).padStart(3, ' ')}</Text>
                    <Text style={[styles.historyCmd, { color: lang.color }]} numberOfLines={2}>{cmd}</Text>
                    <Pressable onPress={() => execute(cmd)} hitSlop={8} style={styles.historyRun}>
                      <MaterialIcons name="play-arrow" size={15} color={lang.color} />
                    </Pressable>
                  </Pressable>
                ))}
                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    backgroundColor: '#0d0d0d',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trafficLights: { flexDirection: 'row', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  headerTitle: { color: '#00ff41', fontSize: Typography.sm, fontWeight: '700', letterSpacing: 2, fontFamily: MONO },
  langBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, borderWidth: 1 },
  langBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, fontFamily: MONO },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#00ff41' },
  liveDotRunning: { backgroundColor: '#ffaa00' },
  liveText: { color: '#555', fontSize: 9, fontWeight: '700', letterSpacing: 1, fontFamily: MONO },
  hdrBtn: {
    width: 30, height: 30, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 6, borderWidth: 1, borderColor: '#1e1e1e',
  },
  langBarOuter: { backgroundColor: '#0d0d0d', borderBottomWidth: 1, borderBottomColor: '#1a1a1a', maxHeight: 40 },
  langBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.base, paddingVertical: 5 },
  langChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3,
    borderWidth: 1, borderColor: '#222', backgroundColor: '#111',
  },
  langChipText: { color: '#555', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, fontFamily: MONO },
  output: { flex: 1, backgroundColor: '#060606' },
  outputContent: { padding: Spacing.md, gap: 2 },
  entryRow: { gap: 0 },
  entryText: { fontSize: 12, lineHeight: 20, fontFamily: MONO },
  entryMeta: { color: '#333', fontSize: 9, fontFamily: MONO, textAlign: 'right' },
  runningRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  suggestRow: { flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 4, backgroundColor: '#0c0c0c' },
  suggestChip: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  suggestText: { color: '#00ff41', fontSize: 10, fontFamily: MONO },
  stdinToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a',
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  stdinToggleText: { color: '#444', fontSize: 9, fontWeight: '700', letterSpacing: 1, fontFamily: MONO, flex: 1 },
  stdinDot: { width: 5, height: 5, borderRadius: 2.5 },
  stdinBox: { backgroundColor: '#080808', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  stdinInput: { color: Colors.info, fontSize: 11, lineHeight: 18, fontFamily: MONO, padding: Spacing.md, minHeight: 60, textAlignVertical: 'top' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    backgroundColor: '#0d0d0d', borderTopWidth: 1, borderTopColor: '#1a1a1a',
    paddingHorizontal: Spacing.md, paddingTop: 8,
  },
  historyNav: { flexDirection: 'column', gap: 0 },
  navBtn: { padding: 2 },
  inputWrap: { flex: 1, backgroundColor: '#000', borderWidth: 1, borderRadius: 4, minHeight: 40, maxHeight: 120, position: 'relative' },
  highlightLayer: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, padding: 9, justifyContent: 'flex-start' },
  highlightText: { fontSize: 12, lineHeight: 20, fontFamily: MONO },
  termInput: { fontSize: 12, lineHeight: 20, fontFamily: MONO, padding: 9, color: '#00ff41', textAlignVertical: 'top' },
  runBtn: { width: 40, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  runBtnDisabled: { opacity: 0.3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0d0d0d', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: '#1a1a1a', paddingHorizontal: Spacing.base, paddingBottom: 32,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#222', borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.base },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.base },
  modalTitle: { color: '#00ff41', fontSize: Typography.base, fontWeight: '700', letterSpacing: 2, fontFamily: MONO },
  emptyHistory: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  emptyHistoryText: { color: '#444', fontSize: Typography.sm, fontFamily: MONO },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: '#111' },
  historyIndex: { color: '#333', fontSize: 11, fontFamily: MONO, marginTop: 1, width: 26 },
  historyCmd: { flex: 1, fontSize: 11, lineHeight: 18, fontFamily: MONO },
  historyRun: { padding: 4 },
});
