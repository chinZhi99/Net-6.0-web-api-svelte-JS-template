<script>
  	import configStore from "./stores/configStore.js";
	import Navbar from "./components/navbar.svelte";
	import Index from "./pages/index.svelte";
	import Todo from "./pages/todo.svelte";
	import PageNotFound from "./pages/not-found.svelte";

	let config = null;
	configStore.subscribe((data) => {
		config = data;
	});

	/* Nav Logic */
	let currentPage = "Todo";

	const handlePageNavigationOnClick = (destination) => {
		currentPage = destination;
	}
	const handlePageNavigationOnMessage = (event) => {
		currentPage = event.detail.text;
	}
	/* Nav Logic */
</script>

<Navbar on:message={handlePageNavigationOnMessage}>
	<li class="nav-item">
		<a class="nav-link" class:active="{currentPage === "Index"}" 
		aria-current="Index" href="#" 
		on:click={() => handlePageNavigationOnClick("Index")}>Home</a>
	</li>
	<li class="nav-item">
		<a class="nav-link" class:active="{currentPage === "Todo"}" 
		aria-current="Todo" href="#" 
		on:click={() => handlePageNavigationOnClick("Todo")}>Todo</a>
	</li>
</Navbar>

<div class="container-fluid mt-3">
	{#if currentPage == "Index"}
		<Index></Index>
	{:else if currentPage == "Todo"}
		<Todo></Todo>
	{:else}
		<PageNotFound></PageNotFound>
	{/if}
</div>




