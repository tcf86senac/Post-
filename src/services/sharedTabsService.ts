import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
  increment,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebaseClient';
import {
  CategoryTab,
  Note,
  NoteComment,
  SharedMember,
  TabInviteRecord,
} from '../types';

export const toFirestoreId = (raw: string, maxLen = 120): string => {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, maxLen);
  return cleaned || `id_${Date.now()}`;
};

export const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
};

export const buildInviteDocId = (tabDocId: string, inviteeEmail: string): string => {
  return `${toFirestoreId(tabDocId, 60)}__${sanitizeEmail(inviteeEmail)}`.slice(0, 128);
};

export const buildDeterministicTabDocId = (tabId: string, ownerUid: string): string => {
  const safeTab = toFirestoreId(tabId, 48);
  const safeUid = toFirestoreId(ownerUid, 36);
  return `tab_${safeTab}_${safeUid}`.slice(0, 128);
};

const safeString = (value: string | undefined | null, fallback: string, maxLen: number): string => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
};

const formatTimestampLabel = (ts: unknown): string => {
  try {
    if (ts instanceof Timestamp) {
      const date = ts.toDate();
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // ignore
  }
  return 'Agora';
};

const timestampToMs = (ts: unknown): number => {
  try {
    if (ts instanceof Timestamp) {
      return ts.toMillis();
    }
  } catch {
    // ignore
  }
  return Date.now();
};

/**
 * Ensures a local CategoryTab exists in Firestore `/sharedTabs/{tabDocId}`
 * and seeds existing local notes inside that tab if Firestore has no notes yet.
 */
export const ensureSharedTabInFirestore = async (
  tab: CategoryTab,
  user: User,
  existingNotesForTab: Note[] = []
): Promise<{ tabDocId: string; shareCode: string }> => {
  const ownerEmail = (user.email || '').trim().toLowerCase();
  if (!ownerEmail) {
    throw new Error('Sua conta Google precisa ter um e-mail verificado para compartilhar abas.');
  }

  const ownerUid = toFirestoreId(user.uid, 128);
  const ownerName = safeString(user.displayName, ownerEmail.split('@')[0], 80);
  const safeTabId = toFirestoreId(tab.id, 64);
  const tabDocId = tab.firestoreId
    ? toFirestoreId(tab.firestoreId, 128)
    : buildDeterministicTabDocId(safeTabId, ownerUid);
  const shareCode = safeString(
    tab.shareCode,
    `SHARE-${safeTabId.toUpperCase().slice(0, 12)}-${Math.floor(1000 + Math.random() * 9000)}`,
    64
  );

  const tabPath = `sharedTabs/${tabDocId}`;
  const tabRef = doc(db, 'sharedTabs', tabDocId);

  let existed = false;
  try {
    const snap = await getDoc(tabRef);
    existed = snap.exists();
    if (!existed) {
      await setDoc(tabRef, {
        tabId: safeTabId,
        label: safeString(tab.label, 'ABA COMPARTILHADA', 60),
        ownerUid,
        ownerEmail,
        ownerName,
        shareCode,
        isShared: true,
        memberEmails: [ownerEmail],
        editorEmails: [ownerEmail],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const data = snap.data();
      if (data && data.ownerUid === ownerUid) {
        await updateDoc(tabRef, {
          label: safeString(tab.label, data.label || 'ABA', 60),
          isShared: true,
          shareCode,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, existed ? OperationType.UPDATE : OperationType.CREATE, tabPath);
  }

  // Ensure owner's confirmed member subdocument exists
  const ownerMemberPath = `sharedTabs/${tabDocId}/members/${ownerUid}`;
  try {
    const memberRef = doc(db, 'sharedTabs', tabDocId, 'members', ownerUid);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) {
      await setDoc(memberRef, {
        uid: ownerUid,
        email: ownerEmail,
        name: ownerName,
        role: 'editor',
        joinedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ownerMemberPath);
  }

  // Seed existing local notes into Firestore once so invited users see the board's current notes
  if (existingNotesForTab.length > 0) {
    const notesPath = `sharedTabs/${tabDocId}/notes`;
    try {
      const existingSnap = await getDocs(collection(db, 'sharedTabs', tabDocId, 'notes'));
      if (existingSnap.empty) {
        const batch = writeBatch(db);
        existingNotesForTab.forEach((n) => {
          const noteId = toFirestoreId(n.id, 128);
          const noteRef = doc(db, 'sharedTabs', tabDocId, 'notes', noteId);
          batch.set(noteRef, {
            noteId,
            tabDocId,
            tabId: safeTabId,
            title: safeString(n.title, 'Lembrete', 140),
            previewText: (n.previewText || '').slice(0, 400),
            fullContent: (n.fullContent || n.previewText || '').slice(0, 10000),
            color: safeString(n.color, 'yellow', 24),
            pinColor: safeString(n.pinColor, 'red', 24),
            penColor: safeString(n.penColor, 'blue', 24),
            fontStyle: safeString(n.fontStyle, 'handwriting', 24),
            isPinned: Boolean(n.isPinned),
            rotation: typeof n.rotation === 'number' ? n.rotation : 0,
            authorUid: ownerUid,
            authorEmail: ownerEmail,
            authorName: ownerName,
            commentsCount: typeof n.commentsCount === 'number' ? n.commentsCount : 0,
            displayCreatedAt: safeString(n.createdAt, 'Hoje', 40),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, notesPath);
    }
  }

  return { tabDocId, shareCode };
};

export const updateSharedTabStatus = async (
  tabDocId: string,
  isShared: boolean,
  label?: string
): Promise<void> => {
  const safeTabDocId = toFirestoreId(tabDocId, 128);
  const path = `sharedTabs/${safeTabDocId}`;
  try {
    const payload: Record<string, unknown> = {
      isShared,
      updatedAt: serverTimestamp(),
    };
    if (label && label.trim()) {
      payload.label = label.trim().slice(0, 60);
    }
    await updateDoc(doc(db, 'sharedTabs', safeTabDocId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

/**
 * Creates or refreshes a pending semi-automatic invite in `/tabInvites/{tabDocId}__{sanitizedEmail}`.
 * Notice the invitee is NOT added to `memberEmails` until they explicitly accept in the app!
 */
export const sendTabInvite = async (params: {
  tabDocId: string;
  tabId: string;
  tabLabel: string;
  shareCode: string;
  inviteeEmail: string;
  inviteeName: string;
  role: 'editor' | 'viewer';
  inviterUser: User;
}): Promise<TabInviteRecord> => {
  const inviterEmail = (params.inviterUser.email || '').trim().toLowerCase();
  const inviterUid = toFirestoreId(params.inviterUser.uid, 128);
  const inviterName = safeString(params.inviterUser.displayName, inviterEmail.split('@')[0], 80);
  const normalizedInviteeEmail = params.inviteeEmail.trim().toLowerCase().slice(0, 120);
  const safeInviteeName = safeString(
    params.inviteeName,
    normalizedInviteeEmail.split('@')[0] || 'Convidado',
    80
  );
  const safeTabDocId = toFirestoreId(params.tabDocId, 128);
  const safeTabId = toFirestoreId(params.tabId, 64);
  const safeTabLabel = safeString(params.tabLabel, 'ABA COMPARTILHADA', 60);
  const safeShareCode = safeString(params.shareCode, `SHARE-${safeTabId}`, 64);

  const inviteId = buildInviteDocId(safeTabDocId, normalizedInviteeEmail);
  const invitePath = `tabInvites/${inviteId}`;
  const inviteRef = doc(db, 'tabInvites', inviteId);

  let alreadyExists = false;
  try {
    const snap = await getDoc(inviteRef);
    alreadyExists = snap.exists();
    if (!alreadyExists) {
      await setDoc(inviteRef, {
        tabDocId: safeTabDocId,
        tabId: safeTabId,
        tabLabel: safeTabLabel,
        inviterUid,
        inviterEmail,
        inviterName,
        inviteeEmail: normalizedInviteeEmail,
        inviteeName: safeInviteeName,
        role: params.role,
        status: 'pending',
        shareCode: safeShareCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(inviteRef, {
        status: 'pending',
        role: params.role,
        inviteeName: safeInviteeName,
        tabLabel: safeTabLabel,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, alreadyExists ? OperationType.UPDATE : OperationType.CREATE, invitePath);
  }

  return {
    id: inviteId,
    tabDocId: safeTabDocId,
    tabId: safeTabId,
    tabLabel: safeTabLabel,
    inviterUid,
    inviterEmail,
    inviterName,
    inviteeEmail: normalizedInviteeEmail,
    inviteeName: safeInviteeName,
    role: params.role,
    status: 'pending',
    shareCode: safeShareCode,
  };
};

/**
 * Owner revokes/removes an invited participant from both `sharedTabs` lists and `tabInvites`.
 */
export const revokeSharedTabMember = async (
  tabDocId: string,
  targetEmail: string
): Promise<void> => {
  const safeTabDocId = toFirestoreId(tabDocId, 128);
  const normalizedTarget = targetEmail.trim().toLowerCase();
  const tabPath = `sharedTabs/${safeTabDocId}`;

  try {
    const tabRef = doc(db, 'sharedTabs', safeTabDocId);
    const snap = await getDoc(tabRef);
    if (snap.exists()) {
      const data = snap.data();
      const nextMembers = ((data.memberEmails as string[]) || []).filter(
        (e) => e.toLowerCase() !== normalizedTarget
      );
      const nextEditors = ((data.editorEmails as string[]) || []).filter(
        (e) => e.toLowerCase() !== normalizedTarget
      );
      await updateDoc(tabRef, {
        memberEmails: nextMembers.length > 0 ? nextMembers : [data.ownerEmail],
        editorEmails: nextEditors.length > 0 ? nextEditors : [data.ownerEmail],
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, tabPath);
  }

  const inviteId = buildInviteDocId(safeTabDocId, normalizedTarget);
  const invitePath = `tabInvites/${inviteId}`;
  try {
    await deleteDoc(doc(db, 'tabInvites', inviteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, invitePath);
  }
};

/**
 * Invitee explicitly ACCEPTS an invite -> atomic batch updating:
 * 1) /tabInvites/{inviteId} -> status = 'accepted'
 * 2) /sharedTabs/{tabDocId}/members/{uid} -> confirmed member doc
 * 3) /sharedTabs/{tabDocId} -> adds own email to memberEmails (and editorEmails if role==='editor')
 */
export const acceptTabInvite = async (
  invite: TabInviteRecord,
  user: User
): Promise<void> => {
  const email = (user.email || '').trim().toLowerCase();
  const uid = toFirestoreId(user.uid, 128);
  const name = safeString(user.displayName, email.split('@')[0], 80);
  const path = `tabInvites/${invite.id}`;

  try {
    const batch = writeBatch(db);

    const inviteRef = doc(db, 'tabInvites', invite.id);
    batch.update(inviteRef, {
      status: 'accepted',
      inviteeName: name,
      updatedAt: serverTimestamp(),
    });

    const memberRef = doc(db, 'sharedTabs', invite.tabDocId, 'members', uid);
    batch.set(memberRef, {
      uid,
      email,
      name,
      role: invite.role,
      joinedAt: serverTimestamp(),
    });

    const tabRef = doc(db, 'sharedTabs', invite.tabDocId);
    const tabUpdates: Record<string, unknown> = {
      memberEmails: arrayUnion(email),
      updatedAt: serverTimestamp(),
    };
    if (invite.role === 'editor') {
      tabUpdates.editorEmails = arrayUnion(email);
    }
    batch.update(tabRef, tabUpdates);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Invitee explicitly DECLINES an invite -> marks invite status = 'declined' without joining tab.
 */
export const declineTabInvite = async (
  invite: TabInviteRecord,
  user: User
): Promise<void> => {
  const email = (user.email || '').trim().toLowerCase();
  const name = safeString(user.displayName, email.split('@')[0], 80);
  const path = `tabInvites/${invite.id}`;

  try {
    await updateDoc(doc(db, 'tabInvites', invite.id), {
      status: 'declined',
      inviteeName: name,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const subscribePendingInvitesForEmail = (
  email: string,
  onUpdate: (invites: TabInviteRecord[]) => void
) => {
  const normalized = email.trim().toLowerCase();
  const path = 'tabInvites';
  const q = query(
    collection(db, path),
    where('inviteeEmail', '==', normalized)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const pending: TabInviteRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.status === 'pending') {
          pending.push({
            id: docSnap.id,
            tabDocId: d.tabDocId,
            tabId: d.tabId,
            tabLabel: d.tabLabel,
            inviterUid: d.inviterUid,
            inviterEmail: d.inviterEmail,
            inviterName: d.inviterName,
            inviteeEmail: d.inviteeEmail,
            inviteeName: d.inviteeName,
            role: d.role,
            status: d.status,
            shareCode: d.shareCode,
          });
        }
      });
      onUpdate(pending);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
};

export const subscribeSentInvitesForUser = (
  inviterUid: string,
  onUpdate: (invites: TabInviteRecord[]) => void
) => {
  const safeUid = toFirestoreId(inviterUid, 128);
  const path = 'tabInvites';
  const q = query(collection(db, path), where('inviterUid', '==', safeUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: TabInviteRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          tabDocId: d.tabDocId,
          tabId: d.tabId,
          tabLabel: d.tabLabel,
          inviterUid: d.inviterUid,
          inviterEmail: d.inviterEmail,
          inviterName: d.inviterName,
          inviteeEmail: d.inviteeEmail,
          inviteeName: d.inviteeName,
          role: d.role,
          status: d.status,
          shareCode: d.shareCode,
        });
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
};

export const subscribeUserSharedTabs = (
  user: User,
  onUpdate: (tabs: CategoryTab[]) => void
) => {
  const email = (user.email || '').trim().toLowerCase();
  const path = 'sharedTabs';
  const q = query(
    collection(db, path),
    where('memberEmails', 'array-contains', email)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: CategoryTab[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const memberEmails = (d.memberEmails as string[]) || [];
        const editorEmails = (d.editorEmails as string[]) || [];

        const sharedWith: SharedMember[] = memberEmails.map((mEmail) => ({
          email: mEmail,
          name:
            mEmail.toLowerCase() === (d.ownerEmail || '').toLowerCase()
              ? d.ownerName || mEmail.split('@')[0]
              : mEmail.split('@')[0],
          role: editorEmails.includes(mEmail) ? 'editor' : 'viewer',
          status: 'accepted',
        }));

        list.push({
          id: docSnap.id,
          firestoreId: docSnap.id,
          label: d.label,
          isShared: Boolean(d.isShared),
          shareCode: d.shareCode,
          ownerUid: d.ownerUid,
          ownerEmail: d.ownerEmail,
          ownerName: d.ownerName,
          memberEmails,
          editorEmails,
          sharedWith,
        });
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
};

export const subscribeSharedTabNotes = (
  tabDocId: string,
  onUpdate: (notes: Note[]) => void
) => {
  const safeTabDocId = toFirestoreId(tabDocId, 128);
  const path = `sharedTabs/${safeTabDocId}/notes`;

  return onSnapshot(
    collection(db, 'sharedTabs', safeTabDocId, 'notes'),
    (snapshot) => {
      const list: Note[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          category: safeTabDocId,
          firestoreTabId: safeTabDocId,
          title: d.title || 'Lembrete',
          previewText: d.previewText || '',
          fullContent: d.fullContent || d.previewText || '',
          color: (d.color as Note['color']) || 'yellow',
          pinColor: (d.pinColor as Note['pinColor']) || 'red',
          penColor: (d.penColor as Note['penColor']) || 'blue',
          fontStyle: (d.fontStyle as Note['fontStyle']) || 'handwriting',
          isPinned: Boolean(d.isPinned),
          rotation: typeof d.rotation === 'number' ? d.rotation : 0,
          createdAt: d.displayCreatedAt || formatTimestampLabel(d.createdAt),
          updatedAt: formatTimestampLabel(d.updatedAt),
          authorUid: d.authorUid,
          authorEmail: d.authorEmail,
          authorName: d.authorName,
          commentsCount: typeof d.commentsCount === 'number' ? d.commentsCount : 0,
        });
      });
      list.sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)));
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
};

export const upsertSharedNote = async (
  tabDocId: string,
  tabId: string,
  note: Note,
  user: User
): Promise<void> => {
  const safeTabDocId = toFirestoreId(tabDocId, 128);
  const safeTabId = toFirestoreId(tabId, 64);
  const safeNoteId = toFirestoreId(note.id, 128);
  const notePath = `sharedTabs/${safeTabDocId}/notes/${safeNoteId}`;
  const noteRef = doc(db, 'sharedTabs', safeTabDocId, 'notes', safeNoteId);

  const authorEmail = (user.email || '').trim().toLowerCase();
  const authorUid = toFirestoreId(user.uid, 128);
  const authorName = safeString(user.displayName, authorEmail.split('@')[0], 80);

  let existed = false;
  try {
    const snap = await getDoc(noteRef);
    existed = snap.exists();
    if (!existed) {
      await setDoc(noteRef, {
        noteId: safeNoteId,
        tabDocId: safeTabDocId,
        tabId: safeTabId,
        title: safeString(note.title, 'Lembrete Sem Título', 140),
        previewText: (note.previewText || '').slice(0, 400),
        fullContent: (note.fullContent || note.previewText || '').slice(0, 10000),
        color: safeString(note.color, 'yellow', 24),
        pinColor: safeString(note.pinColor, 'red', 24),
        penColor: safeString(note.penColor, 'blue', 24),
        fontStyle: safeString(note.fontStyle, 'handwriting', 24),
        isPinned: Boolean(note.isPinned),
        rotation: typeof note.rotation === 'number' ? note.rotation : 0,
        authorUid,
        authorEmail,
        authorName,
        commentsCount: typeof note.commentsCount === 'number' ? note.commentsCount : 0,
        displayCreatedAt: safeString(note.createdAt, 'Agora', 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(noteRef, {
        title: safeString(note.title, 'Lembrete Sem Título', 140),
        previewText: (note.previewText || '').slice(0, 400),
        fullContent: (note.fullContent || note.previewText || '').slice(0, 10000),
        color: safeString(note.color, 'yellow', 24),
        pinColor: safeString(note.pinColor, 'red', 24),
        penColor: safeString(note.penColor, 'blue', 24),
        fontStyle: safeString(note.fontStyle, 'handwriting', 24),
        isPinned: Boolean(note.isPinned),
        rotation: typeof note.rotation === 'number' ? note.rotation : 0,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, existed ? OperationType.UPDATE : OperationType.CREATE, notePath);
  }
};

export const deleteSharedNote = async (
  tabDocId: string,
  noteId: string
): Promise<void> => {
  const safeTabDocId = toFirestoreId(tabDocId, 128);
  const safeNoteId = toFirestoreId(noteId, 128);
  const path = `sharedTabs/${safeTabDocId}/notes/${safeNoteId}`;

  try {
    await deleteDoc(doc(db, 'sharedTabs', safeTabDocId, 'notes', safeNoteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeNoteComments = (
  tabDocId: string,
  noteId: string,
  onUpdate: (comments: NoteComment[]) => void
) => {
  const safeTabDocId = toFirestoreId(tabDocId, 128);
  const safeNoteId = toFirestoreId(noteId, 128);
  const path = `sharedTabs/${safeTabDocId}/notes/${safeNoteId}/comments`;

  return onSnapshot(
    collection(db, 'sharedTabs', safeTabDocId, 'notes', safeNoteId, 'comments'),
    (snapshot) => {
      const list: NoteComment[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          noteId: d.noteId,
          tabDocId: d.tabDocId,
          authorUid: d.authorUid,
          authorEmail: d.authorEmail,
          authorName: d.authorName,
          text: d.text,
          createdAtLabel: formatTimestampLabel(d.createdAt),
          createdAtMs: timestampToMs(d.createdAt),
        });
      });
      list.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
};

export const addNoteComment = async (
  tabDocId: string,
  noteId: string,
  text: string,
  user: User
): Promise<void> => {
  const trimmed = text.trim().slice(0, 1000);
  if (!trimmed) return;

  const safeTabDocId = toFirestoreId(tabDocId, 128);
  const safeNoteId = toFirestoreId(noteId, 128);
  const commentId = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `sharedTabs/${safeTabDocId}/notes/${safeNoteId}/comments/${commentId}`;

  const authorEmail = (user.email || '').trim().toLowerCase();
  const authorUid = toFirestoreId(user.uid, 128);
  const authorName = safeString(user.displayName, authorEmail.split('@')[0], 80);

  try {
    const batch = writeBatch(db);
    const commentRef = doc(
      db,
      'sharedTabs',
      safeTabDocId,
      'notes',
      safeNoteId,
      'comments',
      commentId
    );
    batch.set(commentRef, {
      commentId,
      noteId: safeNoteId,
      tabDocId: safeTabDocId,
      authorUid,
      authorEmail,
      authorName,
      text: trimmed,
      createdAt: serverTimestamp(),
    });

    const noteRef = doc(db, 'sharedTabs', safeTabDocId, 'notes', safeNoteId);
    batch.update(noteRef, {
      commentsCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteNoteComment = async (
  tabDocId: string,
  noteId: string,
  commentId: string
): Promise<void> => {
  const safeTabDocId = toFirestoreId(tabDocId, 128);
  const safeNoteId = toFirestoreId(noteId, 128);
  const safeCommentId = toFirestoreId(commentId, 128);
  const path = `sharedTabs/${safeTabDocId}/notes/${safeNoteId}/comments/${safeCommentId}`;

  try {
    const batch = writeBatch(db);
    batch.delete(
      doc(
        db,
        'sharedTabs',
        safeTabDocId,
        'notes',
        safeNoteId,
        'comments',
        safeCommentId
      )
    );
    batch.update(doc(db, 'sharedTabs', safeTabDocId, 'notes', safeNoteId), {
      commentsCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
