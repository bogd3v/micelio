<script lang="ts">
import { defineComponent } from 'vue'

// Core default (ADR 0005, section 4): renders nothing; the header's progress bar is enough
export default defineComponent({
  props: {
    /** Reading progress, 0 to 100. */
    progress: { type: Number, default: undefined },
  },
  render: () => null,
})
</script>
