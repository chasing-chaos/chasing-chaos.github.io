import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://fbioxaahusplknzzcjvv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8btvUKWXjuTO7x-Ym_iP4A_jaS6nrfe";

const container = document.querySelector(".reactions[data-page-id]");

if (container) {
  const pageId = container.dataset.pageId;
  const buttons = [...container.querySelectorAll(".reaction-button")];
  const status = container.querySelector(".reaction-status");
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  const setBusy = (busy) => {
    buttons.forEach((button) => {
      button.disabled = busy;
    });
  };

  const ensureAnonymousSession = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;

    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  };

  const loadReactions = async () => {
    const { data, error } = await supabase.rpc("get_reaction_counts", {
      p_page_id: pageId,
    });
    if (error) throw error;

    const byReaction = new Map((data || []).map((row) => [row.reaction, row]));
    buttons.forEach((button) => {
      const row = byReaction.get(button.dataset.reaction);
      button.querySelector(".reaction-count").textContent = row?.count ?? 0;
      button.setAttribute("aria-pressed", row?.selected ? "true" : "false");
    });
  };

  const initialize = async () => {
    setBusy(true);
    try {
      await ensureAnonymousSession();
      await loadReactions();
      status.textContent = "";
    } catch (error) {
      console.error(error);
      status.textContent = "Reactions are temporarily unavailable.";
    } finally {
      setBusy(false);
    }
  };

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      setBusy(true);
      status.textContent = "Saving…";
      try {
        const { error } = await supabase.rpc("toggle_reaction", {
          p_page_id: pageId,
          p_reaction: button.dataset.reaction,
        });
        if (error) throw error;
        await loadReactions();
        status.textContent = "Saved.";
      } catch (error) {
        console.error(error);
        status.textContent = "Could not save your reaction. Please try again.";
      } finally {
        setBusy(false);
      }
    });
  });

  initialize();
}
