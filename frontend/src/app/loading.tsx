export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
