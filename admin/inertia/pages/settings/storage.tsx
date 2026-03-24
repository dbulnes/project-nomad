import { Head } from '@inertiajs/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import SettingsLayout from '~/layouts/SettingsLayout'
import StyledTable from '~/components/StyledTable'
import StyledButton from '~/components/StyledButton'
import StyledModal from '~/components/StyledModal'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import HorizontalBarChart from '~/components/HorizontalBarChart'
import { useModals } from '~/context/ModalContext'
import { useNotifications } from '~/context/NotificationContext'
import { useSystemInfo } from '~/hooks/useSystemInfo'
import { getAllDiskDisplayItems } from '~/hooks/useDiskDisplayData'
import api from '~/lib/api'
import { formatBytes } from '~/lib/util'
import { ZimFileWithMetadata } from '../../../types/zim'
import { FileEntry } from '../../../types/files'
import { ModelResponse } from 'ollama'

export default function StoragePage() {
  const queryClient = useQueryClient()
  const { openModal, closeAllModals } = useModals()
  const { addNotification } = useNotifications()
  const { data: systemInfo } = useSystemInfo({})

  const storageItems = getAllDiskDisplayItems(systemInfo?.disk, systemInfo?.fsSize)

  const { data: zimFiles, isLoading: isLoadingZim } = useQuery<ZimFileWithMetadata[]>({
    queryKey: ['zim-files'],
    queryFn: async () => {
      const res = await api.listZimFiles()
      return res.data.files
    },
  })

  const { data: mapFiles, isLoading: isLoadingMaps } = useQuery<FileEntry[]>({
    queryKey: ['map-files'],
    queryFn: () => api.listMapRegionFiles(),
  })

  const { data: aiModels, isLoading: isLoadingModels } = useQuery<ModelResponse[]>({
    queryKey: ['ollama', 'installedModels'],
    queryFn: async () => {
      const res = await api.getInstalledModels()
      return res ?? []
    },
  })

  const { data: ragFiles, isLoading: isLoadingRag } = useQuery<string[]>({
    queryKey: ['rag-files'],
    queryFn: async () => {
      const res = await api.getStoredRAGFiles()
      return res ?? []
    },
  })

  const zimTotalBytes = zimFiles?.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0) ?? 0
  const aiTotalBytes = aiModels?.reduce((sum, m) => sum + (m.size ?? 0), 0) ?? 0

  function confirmDeleteZim(file: ZimFileWithMetadata) {
    openModal(
      <StyledModal
        title="Delete Content File?"
        onConfirm={async () => {
          closeAllModals()
          try {
            await api.deleteZimFile(file.name.replace('.zim', ''))
            queryClient.invalidateQueries({ queryKey: ['zim-files'] })
            addNotification({ message: `Deleted: ${file.title || file.name}`, type: 'success' })
          } catch {
            addNotification({ message: `Failed to delete ${file.name}`, type: 'error' })
          }
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      >
        <p className="text-text-secondary">
          Are you sure you want to delete <strong>{file.title || file.name}</strong>? This cannot be undone.
        </p>
      </StyledModal>,
      'confirm-delete-zim-modal'
    )
  }

  function confirmDeleteMap(file: FileEntry) {
    openModal(
      <StyledModal
        title="Delete Map File?"
        onConfirm={async () => {
          closeAllModals()
          try {
            await api.deleteMapFile(file.name)
            queryClient.invalidateQueries({ queryKey: ['map-files'] })
            addNotification({ message: `Deleted: ${file.name}`, type: 'success' })
          } catch {
            addNotification({ message: `Failed to delete ${file.name}`, type: 'error' })
          }
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      >
        <p className="text-text-secondary">
          Are you sure you want to delete <strong>{file.name}</strong>? This cannot be undone.
        </p>
      </StyledModal>,
      'confirm-delete-map-modal'
    )
  }

  function confirmDeleteModel(model: ModelResponse) {
    openModal(
      <StyledModal
        title="Delete AI Model?"
        onConfirm={async () => {
          closeAllModals()
          try {
            await api.deleteModel(model.name)
            queryClient.invalidateQueries({ queryKey: ['ollama', 'installedModels'] })
            addNotification({ message: `Deleted model: ${model.name}`, type: 'success' })
          } catch {
            addNotification({ message: `Failed to delete ${model.name}`, type: 'error' })
          }
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      >
        <p className="text-text-secondary">
          Are you sure you want to delete <strong>{model.name}</strong>? You will need to re-download it to use it again.
        </p>
      </StyledModal>,
      'confirm-delete-model-modal'
    )
  }

  function confirmDeleteRag(source: string) {
    openModal(
      <StyledModal
        title="Delete RAG File?"
        onConfirm={async () => {
          closeAllModals()
          try {
            await api.deleteRAGFile(source)
            queryClient.invalidateQueries({ queryKey: ['rag-files'] })
            addNotification({ message: `Deleted: ${source}`, type: 'success' })
          } catch {
            addNotification({ message: `Failed to delete ${source}`, type: 'error' })
          }
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      >
        <p className="text-text-secondary">
          Are you sure you want to delete <strong>{source}</strong> from the knowledge base? This cannot be undone.
        </p>
      </StyledModal>,
      'confirm-delete-rag-modal'
    )
  }

  return (
    <SettingsLayout>
      <Head title="Storage | Project N.O.M.A.D." />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6">
          <h1 className="text-4xl font-semibold mb-2">Storage</h1>
          <p className="text-text-muted mb-6">
            View disk usage and manage downloaded content to free up space.
          </p>

          {/* Disk Usage */}
          <StyledSectionHeader title="Disk Usage" className="mb-4" />
          <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-6 mb-8">
            {storageItems.length > 0 ? (
              <HorizontalBarChart
                items={storageItems}
                progressiveBarColor={true}
                statuses={[
                  { label: 'Normal', min_threshold: 0, color_class: 'bg-desert-olive' },
                  { label: 'Warning', min_threshold: 75, color_class: 'bg-desert-orange' },
                  { label: 'Critical', min_threshold: 90, color_class: 'bg-desert-red' },
                ]}
              />
            ) : (
              <p className="text-text-muted text-center py-4">No storage data available.</p>
            )}
          </div>

          {/* Summary Cards */}
          <StyledSectionHeader title="Content Summary" className="mb-4" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-4">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">ZIM Files</p>
              <p className="text-2xl font-bold text-text-primary">{zimFiles?.length ?? '—'}</p>
              <p className="text-sm text-text-muted mt-1">{formatBytes(zimTotalBytes)}</p>
            </div>
            <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-4">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Map Regions</p>
              <p className="text-2xl font-bold text-text-primary">{mapFiles?.length ?? '—'}</p>
              <p className="text-sm text-text-muted mt-1">files</p>
            </div>
            <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-4">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">AI Models</p>
              <p className="text-2xl font-bold text-text-primary">{aiModels?.length ?? '—'}</p>
              <p className="text-sm text-text-muted mt-1">{formatBytes(aiTotalBytes)}</p>
            </div>
            <div className="bg-surface-primary rounded-lg border-2 border-border-subtle p-4">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">RAG Files</p>
              <p className="text-2xl font-bold text-text-primary">{ragFiles?.length ?? '—'}</p>
              <p className="text-sm text-text-muted mt-1">files</p>
            </div>
          </div>

          {/* ZIM Files */}
          <StyledSectionHeader title="ZIM Files (Content Library)" className="mb-4" />
          <StyledTable<ZimFileWithMetadata & { actions?: any }>
            className="mb-8"
            rowLines={true}
            compact
            loading={isLoadingZim}
            columns={[
              {
                accessor: 'title',
                title: 'Title',
                render: (record) => (
                  <span className="font-medium">{record.title || record.name}</span>
                ),
              },
              {
                accessor: 'size_bytes',
                title: 'Size',
                render: (record) => (
                  <span className="text-text-muted text-sm">
                    {record.size_bytes ? formatBytes(record.size_bytes) : '—'}
                  </span>
                ),
              },
              {
                accessor: 'actions',
                title: '',
                render: (record) => (
                  <StyledButton
                    variant="danger"
                    icon="IconTrash"
                    size="sm"
                    onClick={() => confirmDeleteZim(record)}
                  >
                    Delete
                  </StyledButton>
                ),
              },
            ]}
            data={zimFiles ?? []}
          />

          {/* Map Regions */}
          <StyledSectionHeader title="Map Regions" className="mb-4" />
          <StyledTable<FileEntry & { actions?: any }>
            className="mb-8"
            rowLines={true}
            compact
            loading={isLoadingMaps}
            columns={[
              {
                accessor: 'name',
                title: 'File',
                render: (record) => <span className="font-medium">{record.name}</span>,
              },
              {
                accessor: 'actions',
                title: '',
                render: (record) => (
                  <StyledButton
                    variant="danger"
                    icon="IconTrash"
                    size="sm"
                    onClick={() => confirmDeleteMap(record)}
                  >
                    Delete
                  </StyledButton>
                ),
              },
            ]}
            data={mapFiles ?? []}
          />

          {/* AI Models */}
          <StyledSectionHeader title="AI Models" className="mb-4" />
          <StyledTable<ModelResponse & { actions?: any }>
            className="mb-8"
            rowLines={true}
            compact
            loading={isLoadingModels}
            columns={[
              {
                accessor: 'name',
                title: 'Model',
                render: (record) => <span className="font-medium">{record.name}</span>,
              },
              {
                accessor: 'size',
                title: 'Size',
                render: (record) => (
                  <span className="text-text-muted text-sm">
                    {record.size ? formatBytes(record.size) : '—'}
                  </span>
                ),
              },
              {
                accessor: 'actions',
                title: '',
                render: (record) => (
                  <StyledButton
                    variant="danger"
                    icon="IconTrash"
                    size="sm"
                    onClick={() => confirmDeleteModel(record)}
                  >
                    Delete
                  </StyledButton>
                ),
              },
            ]}
            data={aiModels ?? []}
          />

          {/* RAG Files */}
          <StyledSectionHeader title="Knowledge Base Files (RAG)" className="mb-4" />
          <StyledTable<{ name: string; actions?: any }>
            className="mb-8"
            rowLines={true}
            compact
            loading={isLoadingRag}
            columns={[
              {
                accessor: 'name',
                title: 'File',
                render: (record) => <span className="font-medium">{record.name}</span>,
              },
              {
                accessor: 'actions',
                title: '',
                render: (record) => (
                  <StyledButton
                    variant="danger"
                    icon="IconTrash"
                    size="sm"
                    onClick={() => confirmDeleteRag(record.name)}
                  >
                    Delete
                  </StyledButton>
                ),
              },
            ]}
            data={(ragFiles ?? []).map((f) => ({ name: f }))}
          />
        </main>
      </div>
    </SettingsLayout>
  )
}
