namespace ServerHealthApi.Models
{
    public class ServerHealth
    {
        public long Id { get; set; }
        public string? Site { get; set; }
        public string? Environment { get; set; }
        public string? Name { get; set; }
        public bool HealthStatus { get; set; }
    }
}