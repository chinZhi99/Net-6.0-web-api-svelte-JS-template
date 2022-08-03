<script lang="ts">
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();
  const dispatchPageNavigation = () => {
    dispatch('message', {
			text: 'Index'
		});
  }

  import configStore from "../stores/configStore.js";

  let config = null;
  configStore.subscribe((data) => {
    config = data;
  });
</script>

<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container-fluid">
      <a class="navbar-brand" href="#" on:click="{dispatchPageNavigation}">
        <i class="fa fa-home whiteText"></i>
      </a>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarSupportedContent"
        aria-controls="navbarSupportedContent"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon" />
      </button>
      <div class="collapse navbar-collapse" id="navbarSupportedContent">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          <slot />
        </ul>
      </div>
    </div>
  </nav>
