import { useRef, useState } from "react";
import { parseExcelFile, parseManualNumbers, type ParsedTrackingNumber } from "./input-parser";

export function useTrackingInput(
  createTask: (input: {
    name: string;
    sourceFileName?: string;
    trackingNumbers: ParsedTrackingNumber[];
  }) => Promise<unknown>,
) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [manualNumbers, setManualNumbers] = useState("");
  const [parsedNumbers, setParsedNumbers] = useState<ParsedTrackingNumber[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);
  const [queryStarted, setQueryStarted] = useState(false);

  const numberCount = parsedNumbers.length;

  const pickFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      setFileName(file.name);
      setParsedNumbers(parsed);
      setManualNumbers("");
      setQueryStarted(false);
      setInputError(null);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "Excel 文件读取失败");
    }
  };

  const setManualInput = (value: string) => {
    setManualNumbers(value);
    setParsedNumbers(parseManualNumbers(value));
    setFileName("");
    setQueryStarted(false);
    setInputError(null);
  };

  const clearFile = () => {
    setFileName("");
    setParsedNumbers([]);
    setInputError(null);
  };

  const clearManual = () => {
    setManualNumbers("");
    setParsedNumbers([]);
    setInputError(null);
  };

  const startQuery = async () => {
    if (!parsedNumbers.length || queryStarted) return;
    setQueryStarted(true);
    try {
      await createTask({
        name: fileName || "手动输入单号",
        sourceFileName: fileName || undefined,
        trackingNumbers: parsedNumbers,
      });
    } catch (error) {
      setQueryStarted(false);
      setInputError(error instanceof Error ? error.message : "任务创建失败");
    }
  };

  return {
    fileRef,
    fileName,
    manualNumbers,
    numberCount,
    queryStarted,
    inputError,
    pickFile,
    setManualInput,
    clearFile,
    clearManual,
    startQuery,
  };
}
