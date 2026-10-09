import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://fbioxaahusplknzzcjvv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8btvUKWXjuTO7x-Ym_iP4A_jaS6nrfe";

const container = document.querySelector(".comments[data-page-id]");

if (container) {
  const pageId = container.dataset.pageId;
  const form = container.querySelector(".comment-form");
  const nameInput = form.elements.name;
  const bodyInput = form.elements.comment;
  const submitButton = form.querySelector("button[type='submit']");
  const formStatus = container.querySelector(".comment-form-status");
  const list = container.querySelector(".comment-list");
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  const ensureAnonymousSession = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;

    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  };

  const renderComments = (comments) => {
    list.replaceChildren();

    if (!comments.length) {
      const empty = document.createElement("p");
      empty.className = "comment-empty";
      empty.textContent = "No comments yet.";
      list.append(empty);
      return;
    }

    comments.forEach((comment) => {
      const article = document.createElement("article");
      article.className = "comment";

      const header = document.createElement("header");
      header.className = "comment-header";

      const name = document.createElement("span");
      name.className = "comment-name";
      name.textContent = comment.nickname;

      const time = document.createElement("time");
      time.className = "comment-time";
      time.dateTime = comment.created_at;
      time.textContent = new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(comment.created_at));

      const body = document.createElement("p");
      body.className = "comment-body";
      body.textContent = comment.body;

      header.append(name, time);
      article.append(header, body);
      list.append(article);
    });
  };

  const loadComments = async () => {
    const { data, error } = await supabase.rpc("get_approved_comments", {
      p_page_id: pageId,
    });
    if (error) throw error;
    renderComments(data || []);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    formStatus.textContent = "Submitting…";

    try {
      await ensureAnonymousSession();
      const { error } = await supabase.rpc("submit_comment", {
        p_page_id: pageId,
        p_nickname: nameInput.value.trim() || "Anonymous",
        p_body: bodyInput.value.trim(),
      });
      if (error) throw error;

      form.reset();
      formStatus.textContent = "Thanks — your comment is awaiting moderation.";
    } catch (error) {
      console.error(error);
      formStatus.textContent = error.message?.includes("Please wait")
        ? "Please wait a minute before commenting again."
        : "Could not submit your comment. Please try again.";
    } finally {
      submitButton.disabled = false;
    }
  });

  loadComments().catch((error) => {
    console.error(error);
    list.innerHTML = '<p class="comment-empty">Comments are temporarily unavailable.</p>';
  });
}
