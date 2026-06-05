import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Message } from '@/services/aiService';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useChatContext } from '@/hooks/useChatContext';

interface Props {
  message: Message;
}

// Render inline bold/italic/code
function renderInlineText(text: string, baseStyle: any, key: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g);
  return (
    <Text key={key} style={baseStyle}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={styles.bold}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <Text key={i} style={styles.inlineCode}>{part.slice(1, -1)}</Text>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <Text key={i} style={styles.italic}>{part.slice(1, -1)}</Text>;
        }
        return part;
      })}
    </Text>
  );
}

function CodeBlock({
  code,
  lang,
  onRunInTerminal,
}: {
  code: string;
  lang: string;
  onRunInTerminal: (code: string, lang: string) => void;
}) {
  const handleCopy = async () => {
    await Clipboard.setStringAsync(code.trim());
  };

  const EXEC_LANGS = ['bash', 'sh', 'python', 'python3', 'javascript', 'js', 'node',
    'typescript', 'ts', 'go', 'rust', 'ruby', 'c', 'cpp', 'php', 'perl', 'lua', 'powershell'];
  const isExecutable = !lang || EXEC_LANGS.includes(lang.toLowerCase());

  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeHeader}>
        <View style={styles.codeDots}>
          <View style={[styles.codeDot, { backgroundColor: '#ff5f57' }]} />
          <View style={[styles.codeDot, { backgroundColor: '#febc2e' }]} />
          <View style={[styles.codeDot, { backgroundColor: '#28c840' }]} />
        </View>
        {lang ? <Text style={styles.codeLang}>{lang.toUpperCase()}</Text> : null}
        <View style={styles.codeActions}>
          {isExecutable ? (
            <Pressable
              onPress={() => onRunInTerminal(code.trim(), lang || 'bash')}
              hitSlop={8}
              style={({ pressed }) => [styles.runBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="play-arrow" size={11} color="#00ff41" />
              <Text style={styles.runText}>RUN</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={handleCopy} hitSlop={8} style={styles.copyBtn}>
            <Text style={styles.copyText}>COPY</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.codeText} selectable>{code.trim()}</Text>
      </ScrollView>
    </View>
  );
}

function ContentRenderer({ content, runInTerminal, router }: {
  content: string;
  runInTerminal: (code: string, lang: string) => void;
  router: any;
}) {
  // Guard: ensure content is a plain string
  const safeContent = typeof content === 'string' ? content : String(content ?? '');

  // Split into code blocks and text segments
  const segments = safeContent.split(/(```[\s\S]*?```)/g);
  let keyCounter = 0;
  const elements: React.ReactNode[] = [];

  for (const segment of segments) {
    if (segment.startsWith('```') && segment.endsWith('```')) {
      const inner = segment.slice(3, -3);
      const newlineIdx = inner.indexOf('\n');
      const lang = newlineIdx > 0 ? inner.slice(0, newlineIdx).trim() : '';
      const code = newlineIdx > 0 ? inner.slice(newlineIdx + 1) : inner;
      elements.push(
        <CodeBlock
          key={`cb-${keyCounter++}`}
          code={code}
          lang={lang}
          onRunInTerminal={(c, l) => {
            runInTerminal(c, l);
            router.push('/(tabs)/terminal');
          }}
        />
      );
    } else {
      const lines = segment.split('\n');
      for (const line of lines) {
        const k = `l-${keyCounter++}`;
        if (line.trim() === '') {
          elements.push(<View key={k} style={styles.spacer} />);
        } else if (/^#{1,3}\s/.test(line)) {
          const level = (line.match(/^#+/) || [''])[0].length;
          const text = line.replace(/^#+\s/, '');
          elements.push(
            <Text key={k} style={level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3}>
              {text}
            </Text>
          );
        } else if (/^[\-\*•]\s/.test(line)) {
          elements.push(
            <View key={k} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>▸</Text>
              {renderInlineText(line.replace(/^[\-\*•]\s/, ''), styles.bulletText, `bt-${keyCounter++}`)}
            </View>
          );
        } else if (/^\d+\.\s/.test(line)) {
          const num = (line.match(/^\d+/) || ['1'])[0];
          elements.push(
            <View key={k} style={styles.bulletRow}>
              <Text style={styles.numDot}>{num}.</Text>
              {renderInlineText(line.replace(/^\d+\.\s/, ''), styles.bulletText, `nt-${keyCounter++}`)}
            </View>
          );
        } else if (line.startsWith('> ')) {
          elements.push(
            <View key={k} style={styles.blockquote}>
              <Text style={styles.blockquoteText}>{line.slice(2)}</Text>
            </View>
          );
        } else {
          elements.push(renderInlineText(line, styles.bodyText, k));
        }
      }
    }
  }

  return <>{elements}</>;
}

export const MessageBubble = memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const isTool = message.kind === 'tool';
  const { runInTerminal } = useChatContext();
  const router = useRouter();

  // Guard: content must be a string
  const content = typeof message.content === 'string'
    ? message.content
    : JSON.stringify(message.content ?? '');

  if (isTool) {
    return (
      <View style={styles.toolRow}>
        <View style={styles.toolHeader}>
          <View style={styles.toolBadge}>
            <Text style={styles.toolLabel}>⚙ AUTO-EXEC</Text>
          </View>
          <Text style={styles.timestamp}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.toolBubble}>
          <ContentRenderer
            content={content}
            runInTerminal={runInTerminal}
            router={router}
          />
        </View>
      </View>
    );
  }

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText} selectable>{content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <View style={styles.assistantHeader}>
        <View style={styles.axiomBadge}>
          <Text style={styles.axiomLabel}>AXIOM</Text>
        </View>
        {message.isStreaming ? <View style={styles.streamingDot} /> : null}
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <View style={styles.assistantBubble}>
        <ContentRenderer
          content={content}
          runInTerminal={runInTerminal}
          router={router}
        />
        {message.isStreaming ? <Text style={styles.cursor}>▊</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  userRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
  },
  userBubble: {
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    borderRadius: Radius.lg,
    borderBottomRightRadius: Radius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    maxWidth: '82%',
  },
  userText: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  assistantRow: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.base,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  axiomBadge: {
    backgroundColor: Colors.primary + '22',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 3,
  },
  axiomLabel: {
    color: Colors.primary,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    letterSpacing: 1.5,
  },
  streamingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  timestamp: {
    color: Colors.textMuted,
    fontSize: 9,
    marginLeft: 'auto' as any,
  },
  assistantBubble: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.lg,
    borderTopLeftRadius: Radius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  h1: {
    color: Colors.primary,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
  },
  h2: {
    color: Colors.accent,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    marginTop: 5,
    marginBottom: 3,
  },
  h3: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    marginTop: 4,
    marginBottom: 2,
  },
  bodyText: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    lineHeight: 23,
    marginVertical: 1,
  },
  bold: {
    color: Colors.accent,
    fontWeight: Typography.bold,
  },
  italic: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  inlineCode: {
    color: Colors.accent,
    backgroundColor: Colors.accentMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: Typography.sm,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingRight: Spacing.sm,
  },
  bulletDot: {
    color: Colors.primary,
    fontWeight: Typography.bold,
    fontSize: Typography.sm,
    marginTop: 3,
    marginRight: 8,
    flexShrink: 0,
  },
  numDot: {
    color: Colors.primary,
    fontWeight: Typography.bold,
    fontSize: Typography.sm,
    marginTop: 1,
    marginRight: 6,
    flexShrink: 0,
    minWidth: 20,
  },
  bulletText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    paddingLeft: Spacing.md,
    marginVertical: 4,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 2,
    paddingVertical: 4,
  },
  blockquoteText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  spacer: {
    height: 6,
  },
  codeBlock: {
    backgroundColor: '#030303',
    borderWidth: 1,
    borderColor: Colors.accent + '33',
    borderRadius: Radius.md,
    marginVertical: Spacing.sm,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent + '22',
    gap: Spacing.sm,
  },
  codeDots: { flexDirection: 'row', gap: 5 },
  codeDot: { width: 8, height: 8, borderRadius: 4 },
  codeLang: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: '700' as any,
    letterSpacing: 1,
    flex: 1,
  },
  codeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#00ff4118',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00ff4144',
  },
  runText: {
    color: '#00ff41',
    fontSize: 9,
    fontWeight: '700' as any,
    letterSpacing: 1,
  },
  copyBtn: {
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
  },
  copyText: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: '700' as any,
    letterSpacing: 1,
  },
  codeText: {
    color: Colors.accent,
    fontSize: 12,
    lineHeight: 20,
    padding: Spacing.md,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cursor: {
    color: Colors.accent,
    fontSize: Typography.base,
    marginTop: 4,
  },
  toolRow: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.base,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  toolBadge: {
    backgroundColor: '#00ff4118',
    borderWidth: 1,
    borderColor: '#00ff4155',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 3,
  },
  toolLabel: {
    color: '#00ff41',
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    letterSpacing: 1.5,
  },
  toolBubble: {
    backgroundColor: '#020a02',
    borderWidth: 1,
    borderColor: '#00ff4133',
    borderLeftWidth: 3,
    borderLeftColor: '#00ff41',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
});
