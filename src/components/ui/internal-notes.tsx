"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  KeyboardEvent,
} from "react";
import { StickyNote, Plus, Bell, AtSign, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { getCurrentRole, type UserRole } from "@/lib/roles";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ─── Team ─── */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { id: "usr-000", name: "Manny Garcia",    email: "manny.garcia@travelwifi.com", initials: "MA", role: "admin" },
  { id: "usr-001", name: "Maria Garcia",    email: "maria.g@travelwifi.com",  initials: "MR", role: "admin"   },
  { id: "usr-002", name: "Carlos Rodriguez",email: "carlos.r@travelwifi.com", initials: "CR", role: "manager" },
  { id: "usr-003", name: "Sarah Kim",       email: "sarah.k@travelwifi.com",  initials: "SK", role: "agent"   },
  { id: "usr-004", name: "James Chen",      email: "james.c@travelwifi.com",  initials: "JC", role: "agent"   },
  { id: "usr-005", name: "Emma Wilson",     email: "emma.w@travelwifi.com",   initials: "EW", role: "agent"   },
  { id: "usr-006", name: "David Park",      email: "david.p@travelwifi.com",  initials: "DP", role: "viewer"  },
  { id: "usr-007", name: "Lisa Tanaka",     email: "lisa.t@travelwifi.com",   initials: "LT", role: "manager" },
];

/** Get logged-in user from localStorage email set at login */
function getCurrentUser(): TeamMember {
  if (typeof window === "undefined") return TEAM_MEMBERS[0];
  const email = localStorage.getItem("travelwifi_ops_user_email");
  if (email) {
    const found = TEAM_MEMBERS.find((m) => m.email === email);
    if (found) return found;
  }
  return TEAM_MEMBERS[0];
}

/* ─── Note type ─── */
interface Note {
  id: string;
  author: TeamMember;
  body: string;
  mentions: string[]; // TeamMember ids
  createdAt: Date;
  updatedAt?: Date;
  isNew?: boolean;
}

/* ─── Helpers ─── */
function parseMentions(text: string): string[] {
  const matches = text.matchAll(/@([A-Za-z]+(?:\s[A-Za-z]+)?)/g);
  const ids: string[] = [];
  for (const m of matches) {
    const hit = TEAM_MEMBERS.find(
      (t) => t.name.toLowerCase() === m[1].toLowerCase()
    );
    if (hit) ids.push(hit.id);
  }
  return [...new Set(ids)];
}

/** Parse escalation note into structured parts */
function parseEscalationNote(body: string): { type: "escalated" | "status" | "note"; orderNumber: string; content: string } | null {
  // [Escalated] Order TW-123: reason text
  const escalatedMatch = body.match(/^\[Escalated\]\s*Order\s+([^:]+):\s*([\s\S]+)$/);
  if (escalatedMatch) {
    return { type: "escalated", orderNumber: escalatedMatch[1].trim(), content: escalatedMatch[2].trim() };
  }
  // [Escalation - TW-123] note content
  const noteMatch = body.match(/^\[Escalation\s*-\s*([^\]]+)\]\s*([\s\S]+)$/);
  if (noteMatch) {
    const content = noteMatch[2].trim();
    const isStatus = content.includes("started reviewing") || content.includes("Marked as resolved") || content.includes("Reopened");
    return { type: isStatus ? "status" : "note", orderNumber: noteMatch[1].trim(), content };
  }
  return null;
}

/** Render note body with @mention chips highlighted */
function NoteBody({ body }: { body: string }) {
  // Check if this is an escalation note
  const esc = parseEscalationNote(body);
  if (esc) {
    return (
      <div className="rounded-[8px] border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 mt-0.5">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-[600] uppercase tracking-wide",
            esc.type === "escalated"
              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
              : esc.type === "status"
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              : "bg-lavender/20 text-amethyst"
          )}>
            {esc.type === "escalated" ? "Escalated" : esc.type === "status" ? "Status" : "Note"}
          </span>
          <span className="text-[11px] font-[540] text-muted-foreground">
            {esc.orderNumber}
          </span>
        </div>
        <p className="text-[12px] font-[460] text-foreground leading-relaxed">
          {esc.content}
        </p>
      </div>
    );
  }

  const parts = body.split(/(@\w+(?:\s\w+)?)/g);
  return (
    <p className="text-[13px] font-[460] text-foreground leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const name = part.slice(1);
          const hit = TEAM_MEMBERS.find(
            (t) => t.name.toLowerCase() === name.toLowerCase()
          );
          if (hit) {
            return (
              <span
                key={i}
                className="inline-flex items-center gap-0.5 px-1 rounded-[4px] bg-lavender/20 text-amethyst font-[540] text-[12px]"
              >
                {part}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

/** Initials avatar with deterministic color per member */
const AVATAR_COLORS = [
  "bg-amethyst/15 text-amethyst",
  "bg-lavender/30 text-mysteria",
  "bg-cream text-charcoal",
  "bg-parchment text-charcoal",
];

function MemberAvatar({ member, size = "default" }: { member: TeamMember; size?: "sm" | "default" }) {
  const colorIdx = TEAM_MEMBERS.findIndex((t) => t.id === member.id) % AVATAR_COLORS.length;
  return (
    <Avatar size={size}>
      <AvatarFallback
        className={cn(
          "text-[10px] font-[600]",
          AVATAR_COLORS[colorIdx]
        )}
      >
        {member.initials}
      </AvatarFallback>
    </Avatar>
  );
}

/* ─── @mention dropdown ─── */
interface MentionDropdownProps {
  query: string;
  onSelect: (member: TeamMember) => void;
  onClose: () => void;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
}

function MentionDropdown({
  query,
  onSelect,
  onClose,
  activeIndex,
  setActiveIndex,
}: MentionDropdownProps) {
  const results = TEAM_MEMBERS.filter((m) =>
    m.name.toLowerCase().startsWith(query.toLowerCase())
  );

  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(0);
  }, [results.length, activeIndex, setActiveIndex]);

  if (results.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Team members"
      className="absolute bottom-[calc(100%+4px)] left-0 z-50 w-56 rounded-[8px] border border-border bg-popover shadow-md overflow-hidden animate-in fade-in-0 slide-in-from-bottom-1 duration-150"
    >
      <div className="px-2 pt-2 pb-1">
        <span className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground">
          Mention
        </span>
      </div>
      {results.map((member, i) => (
        <button
          key={member.id}
          role="option"
          aria-selected={i === activeIndex}
          onMouseEnter={() => setActiveIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(member);
          }}
          className={cn(
            "w-full flex items-center gap-2.5 px-2 py-1.5 text-left transition-colors",
            i === activeIndex ? "bg-muted" : "hover:bg-muted/60"
          )}
        >
          <MemberAvatar member={member} size="sm" />
          <div className="min-w-0">
            <p className="text-[12px] font-[540] text-foreground truncate">
              {member.name}
            </p>
            <p className="text-[10px] font-[460] text-muted-foreground capitalize">
              {member.role}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ─── Single note row ─── */
function NoteRow({
  note,
  currentUserId,
  currentRole,
  onDelete,
  onEdit,
}: {
  note: Note;
  currentUserId: string;
  currentRole: UserRole;
  onDelete: (id: string) => void;
  onEdit: (id: string, body: string) => void;
}) {
  const isTagged = note.mentions.includes(currentUserId);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.body);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isOwner = note.author.id === currentUserId;
  const canDelete = currentRole === "admin" || isOwner;
  const canEdit = isOwner;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editing]);

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === note.body) {
      setEditing(false);
      setEditText(note.body);
      return;
    }
    onEdit(note.id, trimmed);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "group rounded-[8px] border border-border bg-muted/40 p-3 transition-all duration-200 ease-out",
        note.isNew && !visible
          ? "opacity-0 translate-y-2"
          : "opacity-100 translate-y-0",
        isTagged && "border-amethyst/25 bg-amethyst/[0.03]"
      )}
    >
      <div className="flex items-start gap-2.5">
        <MemberAvatar member={note.author} size="sm" />
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-[600] text-foreground">
              {note.author.name}
            </span>
            {isTagged && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-[4px] bg-amethyst/10 border border-amethyst/20 text-amethyst text-[10px] font-[600]">
                <Bell className="h-2.5 w-2.5" strokeWidth={2} />
                Action needed
              </span>
            )}
            <span className="ml-auto text-[11px] font-[460] text-muted-foreground flex-shrink-0 flex items-center gap-1">
              {note.updatedAt && (
                <span className="text-muted-foreground/60 italic">edited</span>
              )}
              {formatDistanceToNow(note.createdAt, { addSuffix: true })}
            </span>
            {/* Action buttons — visible on hover */}
            {!editing && (canEdit || canDelete) && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-1">
                {canEdit && (
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1 rounded-[4px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Edit note"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={1.8} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDelete(note.id)}
                    className="p-1 rounded-[4px] hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.8} />
                  </button>
                )}
              </div>
            )}
          </div>
          {editing ? (
            <div className="space-y-1.5">
              <textarea
                ref={editRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === "Escape") {
                    setEditing(false);
                    setEditText(note.body);
                  }
                }}
                className="w-full rounded-[8px] border border-border bg-background p-2 text-[13px] font-[460] resize-none min-h-[60px] focus:outline-none focus:ring-1 focus:ring-amethyst/30"
              />
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => { setEditing(false); setEditText(note.body); }}
                  className="p-1 rounded-[4px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Cancel edit"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="p-1 rounded-[4px] hover:bg-amethyst/10 text-amethyst transition-colors"
                  aria-label="Save edit"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>
          ) : (
            <NoteBody body={note.body} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Composer ─── */
interface ComposerProps {
  onSubmit: (body: string, mentions: string[]) => void;
}

function NoteComposer({ onSubmit }: ComposerProps) {
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [dropdownActive, setDropdownActive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mentionStartRef = useRef<number>(-1);

  const openDropdown = useCallback((query: string, start: number) => {
    setMentionQuery(query);
    setDropdownActive(true);
    setActiveIndex(0);
    mentionStartRef.current = start;
  }, []);

  const closeDropdown = useCallback(() => {
    setDropdownActive(false);
    setMentionQuery(null);
    mentionStartRef.current = -1;
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);

      const cursor = e.target.selectionStart ?? val.length;
      const textUpToCursor = val.slice(0, cursor);
      const atMatch = textUpToCursor.match(/@(\w*)$/);

      if (atMatch) {
        const atPos = cursor - atMatch[0].length;
        openDropdown(atMatch[1], atPos);
      } else {
        closeDropdown();
      }
    },
    [openDropdown, closeDropdown]
  );

  const insertMention = useCallback(
    (member: TeamMember) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const cursor = ta.selectionStart ?? text.length;
      const textUpToCursor = text.slice(0, cursor);
      const atMatch = textUpToCursor.match(/@(\w*)$/);
      if (!atMatch) { closeDropdown(); return; }

      const before = text.slice(0, cursor - atMatch[0].length);
      const after = text.slice(cursor);
      const inserted = `@${member.name} `;
      const next = before + inserted + after;

      setText(next);
      closeDropdown();

      // Restore focus and cursor after state update
      requestAnimationFrame(() => {
        ta.focus();
        const pos = before.length + inserted.length;
        ta.setSelectionRange(pos, pos);
      });
    },
    [text, closeDropdown]
  );

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const mentions = parseMentions(trimmed);
    onSubmit(trimmed, mentions);
    setText("");
    closeDropdown();
  }, [text, onSubmit, closeDropdown]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!dropdownActive) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          handleSubmit();
        }
        return;
      }

      const results = TEAM_MEMBERS.filter(
        (m) => mentionQuery === null || m.name.toLowerCase().startsWith(mentionQuery.toLowerCase())
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (results[activeIndex]) insertMention(results[activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
      }
    },
    [dropdownActive, mentionQuery, activeIndex, insertMention, closeDropdown, handleSubmit]
  );

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [closeDropdown]);

  return (
    <div ref={wrapperRef} className="relative">
      {dropdownActive && mentionQuery !== null && (
        <MentionDropdown
          query={mentionQuery}
          onSelect={insertMention}
          onClose={closeDropdown}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
        />
      )}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Add a note… type @ to mention a team member"
        aria-label="New internal note"
        className="rounded-[8px] min-h-[80px] text-[13px] font-[460] resize-none pr-3"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] font-[460] text-muted-foreground flex items-center gap-1">
          <AtSign className="h-3 w-3" strokeWidth={1.8} />
          mention to notify
          <span className="text-muted-foreground/50 ml-1">· ⌘↵ to save</span>
        </span>
        <Button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover disabled:opacity-40 cursor-pointer h-7 px-3"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add Note
        </Button>
      </div>
    </div>
  );
}

/* ─── Main export ─── */
interface InternalNotesProps {
  customerId: string;
}

export function InternalNotes({ customerId }: InternalNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<TeamMember>(TEAM_MEMBERS[0]);
  const [role, setRole] = useState<UserRole>("agent");

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    setRole(getCurrentRole());
  }, []);

  // Fetch notes from API
  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    fetch(`/api/notes?customerId=${encodeURIComponent(customerId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.notes)) {
          setNotes(
            data.notes.map((n: Record<string, unknown>) => ({
              id: n.id as string,
              author: TEAM_MEMBERS.find((m) => m.id === n.authorId) ?? {
                id: n.authorId as string,
                name: n.authorName as string,
                email: "",
                initials: ((n.authorName as string) || "??").slice(0, 2).toUpperCase(),
                role: "agent",
              },
              body: n.body as string,
              mentions: typeof n.mentions === "string" ? JSON.parse(n.mentions as string) : (n.mentions as string[]),
              createdAt: new Date(n.createdAt as string | number),
              updatedAt: n.updatedAt ? new Date(n.updatedAt as string | number) : undefined,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId]);

  const handleSubmit = useCallback(
    (body: string, mentions: string[]) => {
      // Optimistically add the note
      const tempId = `temp-${Date.now()}`;
      const optimistic: Note = {
        id: tempId,
        author: currentUser,
        body,
        mentions,
        createdAt: new Date(),
        isNew: true,
      };
      setNotes((prev) => [optimistic, ...prev]);

      fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          authorId: currentUser.id,
          authorName: currentUser.name,
          body,
          mentions,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            // Replace temp note with server-confirmed note
            setNotes((prev) =>
              prev.map((n) =>
                n.id === tempId ? { ...n, id: data.note.id } : n
              )
            );
          }
        })
        .catch(() => {
          // Remove optimistic note on failure
          setNotes((prev) => prev.filter((n) => n.id !== tempId));
        });
    },
    [customerId, currentUser]
  );

  const handleDelete = useCallback(
    (noteId: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      fetch(
        `/api/notes/${noteId}?role=${role}&authorId=${currentUser.id}`,
        { method: "DELETE" }
      ).catch(() => {
        // Refetch on failure to restore state
        fetch(`/api/notes?customerId=${encodeURIComponent(customerId)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.ok) setNotes(data.notes);
          });
      });
    },
    [role, currentUser.id, customerId]
  );

  const handleEdit = useCallback(
    (noteId: string, newBody: string) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, body: newBody, updatedAt: new Date() } : n
        )
      );
      fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId: currentUser.id, body: newBody }),
      }).catch(() => {});
    },
    [currentUser.id]
  );

  return (
    <Card className="rounded-[16px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-[14px] font-[600] text-foreground flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
          Internal Notes
          {notes.length > 0 && (
            <span className="ml-auto text-[11px] font-[460] text-muted-foreground">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <NoteComposer onSubmit={handleSubmit} />

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && notes.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <div className="space-y-2">
              {notes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  currentUserId={currentUser.id}
                  currentRole={role}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </>
        )}

        {!loading && notes.length === 0 && (
          <p className="text-[12px] font-[460] text-muted-foreground text-center py-3">
            No notes yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
